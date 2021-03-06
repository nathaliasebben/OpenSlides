from typing import Dict, Optional

from django.db import transaction

from ..core.config import config
from ..poll.serializers import default_votes_validator
from ..utils.auth import get_group_model
from ..utils.autoupdate import inform_changed_data
from ..utils.rest_api import (
    CharField,
    DecimalField,
    DictField,
    Field,
    IdPrimaryKeyRelatedField,
    IntegerField,
    ModelSerializer,
    SerializerMethodField,
    ValidationError,
)
from ..utils.validate import validate_html
from .models import (
    Category,
    Motion,
    MotionBlock,
    MotionChangeRecommendation,
    MotionComment,
    MotionCommentSection,
    MotionLog,
    MotionPoll,
    State,
    StatuteParagraph,
    Submitter,
    Workflow,
)


def validate_workflow_field(value):
    """
    Validator to ensure that the workflow with the given id exists.
    """
    if not Workflow.objects.filter(pk=value).exists():
        raise ValidationError({"detail": f"Workflow {value} does not exist."})


class StatuteParagraphSerializer(ModelSerializer):
    """
    Serializer for motion.models.StatuteParagraph objects.
    """

    class Meta:
        model = StatuteParagraph
        fields = ("id", "title", "text", "weight")


class CategorySerializer(ModelSerializer):
    """
    Serializer for motion.models.Category objects.
    """

    class Meta:
        model = Category
        fields = ("id", "name", "prefix")


class MotionBlockSerializer(ModelSerializer):
    """
    Serializer for motion.models.Category objects.
    """

    agenda_type = IntegerField(
        write_only=True, required=False, min_value=1, max_value=3, allow_null=True
    )
    agenda_parent_id = IntegerField(write_only=True, required=False, min_value=1)

    class Meta:
        model = MotionBlock
        fields = ("id", "title", "agenda_item_id", "agenda_type", "agenda_parent_id")

    def create(self, validated_data):
        """
        Customized create method. Set information about related agenda item
        into agenda_item_update_information container.
        """
        agenda_type = validated_data.pop("agenda_type", None)
        agenda_parent_id = validated_data.pop("agenda_parent_id", None)
        motion_block = MotionBlock(**validated_data)
        motion_block.agenda_item_update_information["type"] = agenda_type
        motion_block.agenda_item_update_information["parent_id"] = agenda_parent_id
        motion_block.save()
        return motion_block


class StateSerializer(ModelSerializer):
    """
    Serializer for motion.models.State objects.
    """

    class Meta:
        model = State
        fields = (
            "id",
            "name",
            "recommendation_label",
            "css_class",
            "access_level",
            "allow_support",
            "allow_create_poll",
            "allow_submitter_edit",
            "dont_set_identifier",
            "show_state_extension_field",
            "merge_amendment_into_final",
            "show_recommendation_extension_field",
            "next_states",
            "workflow",
        )


class WorkflowSerializer(ModelSerializer):
    """
    Serializer for motion.models.Workflow objects.
    """

    states = StateSerializer(many=True, read_only=True)

    class Meta:
        model = Workflow
        fields = ("id", "name", "states", "first_state")
        read_only_fields = ("first_state",)

    @transaction.atomic
    def create(self, validated_data):
        """
        Customized create method. Creating a new workflow does always create a
        new state which is used as first state.
        """
        workflow = super().create(validated_data)
        first_state = State.objects.create(
            name="new",
            workflow=workflow,
            allow_create_poll=True,
            allow_support=True,
            allow_submitter_edit=True,
        )
        workflow.first_state = first_state
        workflow.save()
        return workflow


class AmendmentParagraphsJSONSerializerField(Field):
    """
    Serializer for motions's amendment_paragraphs JSONField.
    """

    def to_representation(self, obj):
        """
        Returns the value of the field.
        """
        return obj

    def to_internal_value(self, data):
        """
        Checks that data is a list of strings.
        """
        if not isinstance(data, list):
            raise ValidationError({"detail": "Data must be a list."})
        for paragraph in data:
            if not isinstance(paragraph, str) and paragraph is not None:
                raise ValidationError(
                    {"detail": "Paragraph must be either a string or null/None."}
                )
        return data


class MotionLogSerializer(ModelSerializer):
    """
    Serializer for motion.models.MotionLog objects.
    """

    message = SerializerMethodField()

    class Meta:
        model = MotionLog
        fields = ("message_list", "person", "time", "message")

    def get_message(self, obj):
        """
        Concats the message parts to one string. Useful for smart template code.
        """
        return str(obj)


class MotionPollSerializer(ModelSerializer):
    """
    Serializer for motion.models.MotionPoll objects.
    """

    yes = SerializerMethodField()
    no = SerializerMethodField()
    abstain = SerializerMethodField()
    votes = DictField(
        child=DecimalField(
            max_digits=15, decimal_places=6, min_value=-2, allow_null=True
        ),
        write_only=True,
    )
    has_votes = SerializerMethodField()

    class Meta:
        model = MotionPoll
        fields = (
            "id",
            "motion",
            "yes",
            "no",
            "abstain",
            "votesvalid",
            "votesinvalid",
            "votescast",
            "votes",
            "has_votes",
        )
        validators = (default_votes_validator,)

    def __init__(self, *args, **kwargs):
        # The following dictionary is just a cache for several votes.
        self._votes_dicts: Dict[int, Dict[int, int]] = {}
        super().__init__(*args, **kwargs)

    def get_yes(self, obj):
        try:
            result: Optional[str] = str(self.get_votes_dict(obj)["Yes"])
        except KeyError:
            result = None
        return result

    def get_no(self, obj):
        try:
            result: Optional[str] = str(self.get_votes_dict(obj)["No"])
        except KeyError:
            result = None
        return result

    def get_abstain(self, obj):
        try:
            result: Optional[str] = str(self.get_votes_dict(obj)["Abstain"])
        except KeyError:
            result = None
        return result

    def get_votes_dict(self, obj):
        try:
            votes_dict = self._votes_dicts[obj.pk]
        except KeyError:
            votes_dict = self._votes_dicts[obj.pk] = {}
            for vote in obj.get_votes():
                votes_dict[vote.value] = vote.weight
        return votes_dict

    def get_has_votes(self, obj):
        """
        Returns True if this poll has some votes.
        """
        return obj.has_votes()

    @transaction.atomic
    def update(self, instance, validated_data):
        """
        Customized update method for polls. To update votes use the write
        only field 'votes'.

        Example data:

            "votes": {"Yes": 10, "No": 4, "Abstain": -2}
        """
        # Update votes.
        votes = validated_data.get("votes")
        if votes:
            if len(votes) != len(instance.get_vote_values()):
                raise ValidationError(
                    {
                        "detail": f"You have to submit data for {len(instance.get_vote_values())} vote values."
                    }
                )
            for vote_value in votes.keys():
                if vote_value not in instance.get_vote_values():
                    raise ValidationError(
                        {"detail": f"Vote value {vote_value} is invalid."}
                    )
            instance.set_vote_objects_with_values(
                instance.get_options().get(), votes, skip_autoupdate=True
            )

        # Update remaining writeable fields.
        instance.votesvalid = validated_data.get("votesvalid", instance.votesvalid)
        instance.votesinvalid = validated_data.get(
            "votesinvalid", instance.votesinvalid
        )
        instance.votescast = validated_data.get("votescast", instance.votescast)
        instance.save()
        return instance


class MotionChangeRecommendationSerializer(ModelSerializer):
    """
    Serializer for motion.models.MotionChangeRecommendation objects.
    """

    class Meta:
        model = MotionChangeRecommendation
        fields = (
            "id",
            "motion",
            "rejected",
            "internal",
            "type",
            "other_description",
            "line_from",
            "line_to",
            "text",
            "creation_time",
        )

    def is_title_cr(self, data):
        return int(data["line_from"]) == 0 and int(data["line_to"]) == 0

    def validate(self, data):
        # Change recommendations for titles are stored as plain-text, thus they don't need to be html-escaped
        if "text" in data and not self.is_title_cr(data):
            data["text"] = validate_html(data["text"])
        return data


class MotionCommentSectionSerializer(ModelSerializer):
    """
    Serializer for motion.models.MotionCommentSection objects.
    """

    read_groups = IdPrimaryKeyRelatedField(
        many=True, required=False, queryset=get_group_model().objects.all()
    )

    write_groups = IdPrimaryKeyRelatedField(
        many=True, required=False, queryset=get_group_model().objects.all()
    )

    class Meta:
        model = MotionCommentSection
        fields = ("id", "name", "read_groups", "write_groups")

    def create(self, validated_data):
        """ Call inform_changed_data on creation, so the cache includes the groups. """
        section = super().create(validated_data)
        inform_changed_data(section)
        return section


class MotionCommentSerializer(ModelSerializer):
    """
    Serializer for motion.models.MotionComment objects.
    """

    read_groups_id = SerializerMethodField()

    class Meta:
        model = MotionComment
        fields = ("id", "comment", "section", "read_groups_id")

    def get_read_groups_id(self, comment):
        return [group.id for group in comment.section.read_groups.all()]


class SubmitterSerializer(ModelSerializer):
    """
    Serializer for motion.models.Submitter objects.
    """

    class Meta:
        model = Submitter
        fields = ("id", "user", "motion", "weight")


class MotionSerializer(ModelSerializer):
    """
    Serializer for motion.models.Motion objects.
    """

    comments = MotionCommentSerializer(many=True, read_only=True)
    log_messages = MotionLogSerializer(many=True, read_only=True)
    polls = MotionPollSerializer(many=True, read_only=True)
    modified_final_version = CharField(allow_blank=True, required=False)
    reason = CharField(allow_blank=True, required=False)
    state_access_level = SerializerMethodField()
    text = CharField(allow_blank=True)
    title = CharField(max_length=255)
    amendment_paragraphs = AmendmentParagraphsJSONSerializerField(required=False)
    workflow_id = IntegerField(
        min_value=1, required=False, validators=[validate_workflow_field]
    )
    agenda_type = IntegerField(
        write_only=True, required=False, min_value=1, max_value=3, allow_null=True
    )
    agenda_parent_id = IntegerField(write_only=True, required=False, min_value=1)
    submitters = SubmitterSerializer(many=True, read_only=True)
    change_recommendations = MotionChangeRecommendationSerializer(
        many=True, read_only=True
    )

    class Meta:
        model = Motion
        fields = (
            "id",
            "identifier",
            "title",
            "text",
            "amendment_paragraphs",
            "modified_final_version",
            "reason",
            "parent",
            "category",
            "comments",
            "motion_block",
            "origin",
            "submitters",
            "supporters",
            "state",
            "state_extension",
            "state_access_level",
            "statute_paragraph",
            "workflow_id",
            "recommendation",
            "recommendation_extension",
            "tags",
            "attachments",
            "polls",
            "agenda_item_id",
            "agenda_type",
            "agenda_parent_id",
            "log_messages",
            "sort_parent",
            "weight",
            "created",
            "last_modified",
            "change_recommendations",
        )
        read_only_fields = (
            "state",
            "recommendation",
        )  # Some other fields are also read_only. See definitions above.

    def validate(self, data):
        if "text" in data:
            data["text"] = validate_html(data["text"])

        if "modified_final_version" in data:
            data["modified_final_version"] = validate_html(
                data["modified_final_version"]
            )

        if "reason" in data:
            data["reason"] = validate_html(data["reason"])

        if "amendment_paragraphs" in data:
            data["amendment_paragraphs"] = list(
                map(
                    lambda entry: validate_html(entry)
                    if isinstance(entry, str)
                    else None,
                    data["amendment_paragraphs"],
                )
            )
            data["text"] = ""
        else:
            if "text" in data and not data["text"]:
                raise ValidationError({"detail": "The text field may not be blank."})
            if (
                "reason" in data
                and not data["reason"]
                and config["motions_reason_required"]
            ):
                raise ValidationError({"detail": "The reason field may not be blank."})

        return data

    @transaction.atomic
    def create(self, validated_data):
        """
        Customized method to create a new motion from some data.

        Set also information about related agenda item into
        agenda_item_update_information container.
        """
        motion = Motion()
        motion.title = validated_data["title"]
        motion.text = validated_data["text"]
        motion.amendment_paragraphs = validated_data.get("amendment_paragraphs")
        motion.modified_final_version = validated_data.get("modified_final_version", "")
        motion.reason = validated_data.get("reason", "")
        motion.identifier = validated_data.get("identifier")
        motion.category = validated_data.get("category")
        motion.motion_block = validated_data.get("motion_block")
        motion.origin = validated_data.get("origin", "")
        motion.parent = validated_data.get("parent")
        motion.statute_paragraph = validated_data.get("statute_paragraph")
        motion.reset_state(validated_data.get("workflow_id"))
        motion.agenda_item_update_information["type"] = validated_data.get(
            "agenda_type"
        )
        motion.agenda_item_update_information["parent_id"] = validated_data.get(
            "agenda_parent_id"
        )
        motion.save()
        motion.supporters.add(*validated_data.get("supporters", []))
        motion.attachments.add(*validated_data.get("attachments", []))
        motion.tags.add(*validated_data.get("tags", []))
        return motion

    @transaction.atomic
    def update(self, motion, validated_data):
        """
        Customized method to update a motion.
        """
        workflow_id = None
        if "workflow_id" in validated_data:
            workflow_id = validated_data.pop("workflow_id")

        result = super().update(motion, validated_data)

        if workflow_id is not None and workflow_id != motion.workflow_id:
            motion.reset_state(workflow_id)
            motion.save()

        return result

    def get_state_access_level(self, motion):
        """
        Returns the access level of this state. The default is 0 so everybody
        with permission to see motions can see this motion.
        """
        return motion.state.access_level
