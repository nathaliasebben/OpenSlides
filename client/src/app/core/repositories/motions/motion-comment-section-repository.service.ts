import { Injectable } from '@angular/core';

import { DataSendService } from '../../core-services/data-send.service';
import { DataStoreService } from '../../core-services/data-store.service';
import { BaseRepository } from '../base-repository';
import { ViewMotionCommentSection } from 'app/site/motions/models/view-motion-comment-section';
import { MotionCommentSection } from 'app/shared/models/motions/motion-comment-section';
import { Group } from 'app/shared/models/users/group';
import { Identifiable } from 'app/shared/models/base/identifiable';
import { CollectionStringMapperService } from '../../core-services/collectionStringMapper.service';
import { HttpService } from 'app/core/core-services/http.service';
import { ViewModelStoreService } from 'app/core/core-services/view-model-store.service';
import { ViewGroup } from 'app/site/users/models/view-group';
import { TranslateService } from '@ngx-translate/core';
import { ViewMotion } from 'app/site/motions/models/view-motion';

/**
 * Repository Services for Categories
 *
 * The repository is meant to process domain objects (those found under
 * shared/models), so components can display them and interact with them.
 *
 * Rather than manipulating models directly, the repository is meant to
 * inform the {@link DataSendService} about changes which will send
 * them to the Server.
 */
@Injectable({
    providedIn: 'root'
})
export class MotionCommentSectionRepositoryService extends BaseRepository<
    ViewMotionCommentSection,
    MotionCommentSection
> {
    /**
     * Creates a CategoryRepository
     * Converts existing and incoming category to ViewCategories
     * Handles CRUD using an observer to the DataStore
     *
     * @param mapperService Mapper Service for the Collection Strings
     * @param DS Service that handles the dataStore
     * @param dataSend Service to handle the dataSending
     * @param http Service to handle direct http-communication
     */
    public constructor(
        DS: DataStoreService,
        mapperService: CollectionStringMapperService,
        viewModelStoreService: ViewModelStoreService,
        private dataSend: DataSendService,
        private http: HttpService,
        private translate: TranslateService
    ) {
        super(DS, mapperService, viewModelStoreService, MotionCommentSection, [Group]);
    }

    public getVerboseName = (plural: boolean = false) => {
        return this.translate.instant(plural ? 'Comment sections' : 'Comment section');
    };

    /**
     * Creates the ViewModel for the MotionComment Section
     *
     * @param section the MotionCommentSection the View Model should be created of
     * @returns the View Model representation of the MotionCommentSection
     */
    protected createViewModel(section: MotionCommentSection): ViewMotionCommentSection {
        const readGroups = this.viewModelStoreService.getMany(ViewGroup, section.read_groups_id);
        const writeGroups = this.viewModelStoreService.getMany(ViewGroup, section.write_groups_id);
        const viewMotionCommentSection = new ViewMotionCommentSection(section, readGroups, writeGroups);
        viewMotionCommentSection.getVerboseName = this.getVerboseName;
        return viewMotionCommentSection;
    }

    /**
     * Creates the Comment Section
     *
     * @param section section to be created
     * @returns the promise to create the comment section
     */
    public async create(section: MotionCommentSection): Promise<Identifiable> {
        return await this.dataSend.createModel(section);
    }

    /**
     * Updates an existion CommentSection
     *
     * @param section the update that the section should be created on
     * @param viewSection the view model representation of that section
     */
    public async update(section: Partial<MotionCommentSection>, viewSection?: ViewMotionCommentSection): Promise<void> {
        let updateSection: MotionCommentSection;
        if (viewSection) {
            updateSection = viewSection.section;
        } else {
            updateSection = new MotionCommentSection();
        }
        updateSection.patchValues(section);
        await this.dataSend.updateModel(updateSection);
    }

    /**
     * Deletes a MotionCommentSection
     *
     * @param viewSection the view model representation of the model that should be deleted
     */
    public async delete(viewSection: ViewMotionCommentSection): Promise<void> {
        await this.dataSend.deleteModel(viewSection.section);
    }

    /**
     * Saves a comment made at a MotionCommentSection. Does an update, if
     * there is a comment text. Deletes the comment, if the text is empty.
     *
     * @param motion the motion
     * @param section the section where the comment was made
     * @param sectionComment the comment text
     * @returns the promise from the HTTP request
     */
    public async saveComment(motion: ViewMotion, section: ViewMotionCommentSection, comment: string): Promise<void> {
        if (comment) {
            return await this.updateComment(motion, section, comment);
        } else {
            return await this.deleteComment(motion, section);
        }
    }

    /**
     * Updates the comment. Saves it on the server.
     */
    private async updateComment(motion: ViewMotion, section: ViewMotionCommentSection, comment: string): Promise<void> {
        return await this.http.post(`rest/motions/motion/${motion.id}/manage_comments/`, {
            section_id: section.id,
            comment: comment
        });
    }

    /**
     * Deletes a comment from the server
     */
    private async deleteComment(motion: ViewMotion, section: ViewMotionCommentSection): Promise<void> {
        return await this.http.delete(`rest/motions/motion/${motion.id}/manage_comments/`, { section_id: section.id });
    }
}
