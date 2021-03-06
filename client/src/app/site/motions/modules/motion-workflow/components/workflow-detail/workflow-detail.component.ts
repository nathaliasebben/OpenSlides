import { ActivatedRoute } from '@angular/router';
import { Component, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { MatDialog, MatSnackBar, MatTableDataSource, MatCheckboxChange } from '@angular/material';
import { Observable } from 'rxjs';
import { Title } from '@angular/platform-browser';

import { TranslateService } from '@ngx-translate/core';

import { BaseViewComponent } from 'app/site/base/base-view';
import { ViewWorkflow, StateCssClassMapping } from 'app/site/motions/models/view-workflow';
import { WorkflowRepositoryService } from 'app/core/repositories/motions/workflow-repository.service';
import { WorkflowState, MergeAmendment } from 'app/shared/models/motions/workflow-state';
import { PromptService } from 'app/core/ui-services/prompt.service';

/**
 * Declares data for the workflow dialog
 */
interface DialogData {
    title: string;
    description: string;
    value: string;
    deletable?: boolean;
}

/**
 * Determine answers from the dialog
 */
interface DialogResult {
    action: 'update' | 'delete';
    value?: string;
}

/**
 * Defines state permissions
 */
interface StatePerm {
    name: string;
    selector: string;
    type: string;
    reference?: string;
}

/**
 * Defines the structure of access levels
 */
interface AccessLevel {
    level: number;
    label: string;
}

/**
 * Defines the structure of access levels
 */
interface AmendmentIntoFinal {
    merge: MergeAmendment;
    label: string;
}

/**
 * Motion workflow management detail view
 */
@Component({
    selector: 'os-workflow-detail',
    templateUrl: './workflow-detail.component.html',
    styleUrls: ['./workflow-detail.component.scss']
})
export class WorkflowDetailComponent extends BaseViewComponent implements OnInit {
    /**
     * Reference to the workflow dialog
     */
    @ViewChild('workflowDialog')
    private workflowDialog: TemplateRef<string>;

    /**
     * Holds the dialog data
     */
    public dialogData: DialogData;

    /**
     * Holds the current workflow
     */
    public workflow: ViewWorkflow;

    /**
     * The header rows that the table should show
     * Updated through subscription
     */
    public headerRowDef: string[] = [];

    /**
     * Determine label colors. Where they should come from is currently now know
     */
    public labelColors = ['default', 'primary', 'success', 'danger', 'warning'];

    /**
     * Holds state permissions
     */
    private statePermissionsList = [
        { name: 'Recommendation label', selector: 'recommendation_label', type: 'input' },
        { name: 'Allow support', selector: 'allow_support', type: 'check' },
        { name: 'Allow create poll', selector: 'allow_create_poll', type: 'check' },
        { name: 'Allow submitter edit', selector: 'allow_submitter_edit', type: 'check' },
        { name: 'Set identifier', selector: 'dont_set_identifier', type: 'check' },
        { name: 'Show state extension field', selector: 'show_state_extension_field', type: 'check' },
        {
            name: 'Show recommendation extension field',
            selector: 'show_recommendation_extension_field',
            type: 'check'
        },
        { name: 'Show amendment in parent motoin', selector: 'merge_amendment_into_final', type: 'amendment' },
        { name: 'Access level', selector: 'access_level', type: 'accessLevel' },
        { name: 'Label color', selector: 'css_class', type: 'color' },
        { name: 'Next states', selector: 'next_states_id', type: 'state' }
    ] as StatePerm[];

    /**
     * Determines possible access levels
     */
    public accessLevels = [
        { level: 0, label: '0: All users' },
        { level: 1, label: '1: Submitters and all managers' },
        { level: 2, label: '2: Only managers for motions and metadata' },
        { level: 3, label: '3: Only managers for motions' }
    ] as AccessLevel[];

    /**
     * Determines possible "Merge amendments into final"
     */
    public amendmentIntoFinal = [
        { merge: MergeAmendment.NO, label: 'No' },
        { merge: MergeAmendment.UNDEFINED, label: '-' },
        { merge: MergeAmendment.YES, label: 'Yes' }
    ] as AmendmentIntoFinal[];

    /**
     * Constructor
     *
     * @param title Set the page title
     * @param translate Handle translations
     * @param matSnackBar Showing error
     * @param promtService Promts
     * @param dialog Opening dialogs
     * @param workflowRepo The repository for workflows
     * @param route Read out URL paramters
     */
    public constructor(
        title: Title,
        protected translate: TranslateService, // protected required for ng-translate-extract
        matSnackBar: MatSnackBar,
        private promtService: PromptService,
        private dialog: MatDialog,
        private workflowRepo: WorkflowRepositoryService,
        private route: ActivatedRoute
    ) {
        super(title, translate, matSnackBar);
    }

    /**
     * Init.
     *
     * Observe the parameters of the URL and loads the specified workflow
     */
    public ngOnInit(): void {
        this.route.params.subscribe(params => {
            if (params) {
                this.workflowRepo.getViewModelObservable(params.id).subscribe(newWorkflow => {
                    this.workflow = newWorkflow;
                    this.updateRowDef();
                });
            }
        });
    }

    /**
     * Click handler for the state names.
     * Opens a dialog to rename a state.
     *
     * @param state the selected workflow state
     */
    public onClickStateName(state: WorkflowState): void {
        this.openEditDialog(state.name, 'Rename state', '', true).subscribe(result => {
            if (result) {
                if (result.action === 'update') {
                    this.workflowRepo.updateState({ name: result.value }, state).then(() => {}, this.raiseError);
                } else if (result.action === 'delete') {
                    const content = this.translate.instant('Delete') + ` ${state.name}?`;

                    this.promtService.open('Are you sure', content).then(promptResult => {
                        if (promptResult) {
                            this.workflowRepo.deleteState(state).then(() => {}, this.raiseError);
                        }
                    });
                }
            }
        });
    }

    /**
     * Click handler for the button to add new states the the current workflow
     * Opens a dialog to enter the workflow name
     */
    public onNewStateButton(): void {
        this.openEditDialog('', this.translate.instant('Create new state'), this.translate.instant('Name')).subscribe(
            result => {
                if (result && result.action === 'update') {
                    this.workflowRepo.addState(result.value, this.workflow).then(() => {}, this.raiseError);
                }
            }
        );
    }

    /**
     * Click handler for the edit button.
     * Opens a dialog to rename the workflow
     */
    public onEditWorkflowButton(): void {
        this.openEditDialog(this.workflow.name, 'Edit name', 'Please enter a new workflow name:').subscribe(result => {
            if (result && result.action === 'update') {
                this.workflowRepo.update({ name: result.value }, this.workflow).then(() => {}, this.raiseError);
            }
        });
    }

    /**
     * Handler for the workflow state "input" fields.
     * Opens a dialog to edit a label.
     *
     * @param perm The permission
     * @param state The selected workflow state
     */
    public onClickInputPerm(perm: StatePerm, state: WorkflowState): void {
        this.openEditDialog(state[perm.selector], 'Edit', perm.name).subscribe(result => {
            if (result && result.action === 'update') {
                this.workflowRepo.updateState({ [perm.selector]: result.value }, state).then(() => {}, this.raiseError);
            }
        });
    }

    /**
     * Handler for toggling workflow states
     *
     * @param state The workflow state to edit
     * @param perm The states permission that was changed
     * @param event The change event.
     */
    public onToggleStatePerm(state: WorkflowState, perm: string, event: MatCheckboxChange): void {
        this.workflowRepo.updateState({ [perm]: event.checked }, state).then(() => {}, this.raiseError);
    }

    /**
     * Handler for selecting colors / css classes for workflow states.
     * Sets the css class for the specific workflow
     *
     * @param state The selected workflow state
     * @param color The selected color
     */
    public onSelectColor(state: WorkflowState, color: string): void {
        this.workflowRepo.updateState({ css_class: color }, state).then(() => {}, this.raiseError);
    }

    /**
     * Handler to add or remove next states to a workflow state
     *
     * @param nextState the potential next workflow state
     * @param state the state to add or remove another state to
     */
    public onSetNextState(nextState: WorkflowState, state: WorkflowState): void {
        const ids = state.next_states_id.map(id => id);
        const stateIdIndex = ids.findIndex(id => id === nextState.id);

        if (stateIdIndex < 0) {
            ids.push(nextState.id);
        } else {
            ids.splice(stateIdIndex, 1);
        }
        this.workflowRepo.updateState({ next_states_id: ids }, state).then(() => {}, this.raiseError);
    }

    /**
     * Sets an access level to the given workflow state
     *
     * @param level The new access level
     * @param state the state to change
     */
    public onSetAccesLevel(level: number, state: WorkflowState): void {
        this.workflowRepo.updateState({ access_level: level }, state).then(() => {}, this.raiseError);
    }

    /**
     * Sets the 'merge_amendment_into_final' value
     *
     * @param amendment determines the amendment
     * @param state the state to change
     */
    public setMergeAmendment(amendment: number, state: WorkflowState): void {
        this.workflowRepo.updateState({ merge_amendment_into_final: amendment }, state).then(() => {}, this.raiseError);
    }

    /**
     * Function to open the edit dialog. Returns the observable to the result after the dialog
     * was closed
     *
     * @param value holds the valie
     * @param title The title of the dialog
     * @param description The description of the dialog
     * @param deletable determine if a delete button should be offered
     */
    private openEditDialog(
        value: string,
        title?: string,
        description?: string,
        deletable?: boolean
    ): Observable<DialogResult> {
        this.dialogData = {
            title: title || '',
            description: description || '',
            value: value,
            deletable: deletable
        };

        const dialogRef = this.dialog.open(this.workflowDialog, {
            maxHeight: '90vh',
            width: '400px',
            maxWidth: '90vw'
        });

        return dialogRef.afterClosed();
    }

    /**
     * Returns a merge amendment label from state
     */
    public getMergeAmendmentLabel(mergeAmendment: MergeAmendment): string {
        return this.amendmentIntoFinal.find(amendment => amendment.merge === mergeAmendment).label;
    }

    /**
     * Defines the data source for the workflow state table
     *
     * @returns the MatTableDateSource to iterate over a workflow states contents
     */
    public getTableDataSource(): MatTableDataSource<StatePerm> {
        const dataSource = new MatTableDataSource<StatePerm>();
        dataSource.data = this.statePermissionsList;
        return dataSource;
    }

    /**
     * Update the rowDefinition after Reloading or changes
     */
    public updateRowDef(): void {
        // reset the rowDef list first
        this.headerRowDef = ['perm'];
        if (this.workflow) {
            this.workflow.states.forEach(state => {
                this.headerRowDef.push(this.getColumnDef(state));
            });
        }
    }

    /**
     * Creates a unique column-def from the name and the id of a state
     *
     * @param state the workflow state
     * @returns a unique definition
     */
    public getColumnDef(state: WorkflowState): string {
        return `${state.name}${state.id}`;
    }

    /**
     * Required to detect changes in *ngFor loops
     *
     * @param index Corresponding group that was changed
     * @returns the tracked workflows id
     */
    public trackElement(index: number): number {
        return index;
    }

    /**
     * Translate the state's css class into a color
     *
     * @param colorLabel the default color label of a selected workflow
     * @returns a string representing a color
     */
    public getStateCssColor(colorLabel: string): string {
        return StateCssClassMapping[colorLabel] || '';
    }
}
