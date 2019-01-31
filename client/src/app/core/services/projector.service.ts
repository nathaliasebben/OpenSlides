import { Injectable } from '@angular/core';

import { OpenSlidesComponent } from 'app/openslides.component';
import {
    Projectable,
    ProjectorElementBuildDeskriptor,
    isProjectable,
    isProjectorElementBuildDeskriptor
} from 'app/site/base/projectable';
import { DataStoreService } from './data-store.service';
import {
    Projector,
    ProjectorElement,
    ProjectorElements,
    IdentifiableProjectorElement
} from 'app/shared/models/core/projector';
import { HttpService } from './http.service';
import { SlideManager } from 'app/slides/services/slide-manager.service';
import { BaseModel } from 'app/shared/models/base/base-model';

/**
 * This service cares about Projectables being projected and manage all projection-related
 * actions.
 *
 * We cannot access the ProjectorRepository here, so we will deal with plain projector objects.
 */
@Injectable({
    providedIn: 'root'
})
export class ProjectorService extends OpenSlidesComponent {
    /**
     * Constructor.
     *
     * @param DS
     * @param dataSend
     */
    public constructor(private DS: DataStoreService, private http: HttpService, private slideManager: SlideManager) {
        super();
    }

    /**
     * Checks, if a given object is projected.
     *
     * @param obj The object in question
     * @returns true, if the object is projected on one projector.
     */
    public isProjected(obj: Projectable | ProjectorElementBuildDeskriptor): boolean {
        if (isProjectable(obj)) {
            return this.DS.getAll<Projector>('core/projector').some(projector => {
                return projector.isElementShown(obj.getSlide().getBasicProjectorElement());
            });
        } else {
            return this.DS.getAll<Projector>('core/projector').some(projector => {
                return projector.isElementShown(obj.getBasicProjectorElement());
            });
        }
    }

    /**
     * Get all projectors where the object is prejected on.
     *
     * @param obj The object in question
     * @return All projectors, where this Object is projected on
     */
    public getProjectorsWhichAreProjecting(obj: Projectable | ProjectorElementBuildDeskriptor): Projector[] {
        if (isProjectable(obj)) {
            return this.DS.getAll<Projector>('core/projector').filter(projector => {
                return projector.isElementShown(obj.getSlide().getBasicProjectorElement());
            });
        } else {
            return this.DS.getAll<Projector>('core/projector').filter(projector => {
                return projector.isElementShown(obj.getBasicProjectorElement());
            });
        }
    }

    private getProjectorElement(
        obj: Projectable | ProjectorElementBuildDeskriptor | IdentifiableProjectorElement
    ): IdentifiableProjectorElement {
        if (isProjectable(obj)) {
            return obj.getSlide().getBasicProjectorElement();
        } else if (isProjectorElementBuildDeskriptor(obj)) {
            return obj.getBasicProjectorElement();
        } else {
            return obj;
        }
    }

    /**
     * Checks, if the object is projected on the given projector.
     *
     * @param obj The object
     * @param projector The projector to test
     * @returns true, if the object is projected on the projector.
     */
    public isProjectedOn(
        obj: Projectable | ProjectorElementBuildDeskriptor | IdentifiableProjectorElement,
        projector: Projector
    ): boolean {
        return projector.isElementShown(this.getProjectorElement(obj));
    }

    /**
     * Projects the given ProjectorElement on the given projectors.
     *
     * TODO: this does not care about the element being stable. Some more logic must be added later.
     *
     * On the given projectors: Delete all non-stable elements and add the given element.
     * On all other projectors: If the element (compared with name and id) is there, it will be deleted.
     *
     * @param projectors All projectors where to add the element.
     * @param element The element in question.
     */
    public projectOnMultiple(projectors: Projector[], element: IdentifiableProjectorElement): void {
        this.DS.getAll<Projector>('core/projector').forEach(projector => {
            if (projectors.includes(projector)) {
                this.projectOn(projector, element);
            } else if (projector.isElementShown(element)) {
                this.removeFrom(projector, element);
            }
        });
    }

    public async projectOn(
        projector: Projector,
        obj: Projectable | ProjectorElementBuildDeskriptor | IdentifiableProjectorElement
    ): Promise<void> {
        const element = this.getProjectorElement(obj);

        if (element.stable) {
            // Just add this stable element
            projector.addElement(element);
            await this.projectRequest(projector, projector.elements);
        } else {
            // For non-stable elements remove all other non-stable elements, add them to the history and
            // add the one new element to the projector.
            const removedElements = projector.removeAllNonStableElements();
            let changed = removedElements.length > 0;

            if (element) {
                projector.addElement(element);
                changed = true;
            }
            if (changed) {
                await this.projectRequest(projector, projector.elements, null, removedElements);
            }
        }
    }

    public async removeFrom(
        projector: Projector,
        obj: Projectable | ProjectorElementBuildDeskriptor | IdentifiableProjectorElement
    ): Promise<void> {
        const element = this.getProjectorElement(obj);

        if (element.stable) {
            // Just remove this stable element
            projector.removeElements(element);
            await this.projectRequest(projector, projector.elements);
        } else {
            // For non-stable elements remove all current non-stable elements and add them to the history
            const removedElements = projector.removeElements(element);
            if (removedElements.length > 0) {
                console.log(projector.elements, removedElements);
                await this.projectRequest(projector, projector.elements, null, removedElements);
            }
        }
    }

    private async projectRequest(
        projector: Projector,
        elements?: ProjectorElements,
        preview?: ProjectorElements,
        appendToHistory?: ProjectorElements,
        deleteLastHistroyElement?: boolean
    ): Promise<void> {
        const requestData: any = {};
        if (elements) {
            requestData.elements = elements;
        }
        if (preview) {
            requestData.preview = preview;
        }
        if (appendToHistory && appendToHistory.length) {
            requestData.append_to_history = appendToHistory;
        }
        if (deleteLastHistroyElement) {
            requestData.delete_last_history_element = true;
        }
        if (appendToHistory && appendToHistory.length && deleteLastHistroyElement) {
            throw new Error('You cannot append to the history and delete the last element at the same time');
        }
        await this.http.post(`/rest/core/projector/${projector.id}/project/`, requestData);
    }

    /**
     * Given a projectiondefault, we want to retrieve the projector, that is assigned
     * to this default.
     *
     * @param projectiondefault The projection default
     * @return the projector associated to the given projectiondefault.
     */
    public getProjectorForDefault(projectiondefault: string): Projector {
        return this.DS.getAll<Projector>('core/projector').find(projector => {
            return projector.projectiondefaults.map(pd => pd.name).includes(projectiondefault);
        });
    }

    public getModelFromProjectorElement<T extends BaseModel>(element: IdentifiableProjectorElement): T {
        if (!this.slideManager.canSlideBeMappedToModel(element.name)) {
            throw new Error('THis projectorelement cannot be mapped to a model');
        }
        const identifiers = element.getIdentifiers();
        if (!identifiers.includes('name') || !identifiers.includes('name')) {
            throw new Error('To map this element to a model, a name and id is needed.');
        }
        return this.DS.get<T>(element.name, element.id);
    }

    public async projectNextSlide(projector: Projector): Promise<void> {
        await this.projectPreviewSlide(projector, 0);
    }

    public async projectPreviewSlide(projector: Projector, previewIndex: number): Promise<void> {
        if (projector.elements_preview.length === 0 || previewIndex >= projector.elements_preview.length) {
            return;
        }

        const removedElements = projector.removeAllNonStableElements();
        projector.addElement(projector.elements_preview.splice(previewIndex, 1)[0]);
        await this.projectRequest(projector, projector.elements, projector.elements_preview, removedElements);
    }

    public async projectPreviousSlide(projector: Projector): Promise<void> {
        if (projector.elements_history.length === 0) {
            return;
        }
        // Get the last element from the history
        const lastElements: ProjectorElements = projector.elements_history[projector.elements_history.length - 1];
        let lastElement: ProjectorElement = null;
        if (lastElements.length > 0) {
            lastElement = lastElements[0];
        }

        // Add all current elements to the preview.
        const removedElements = projector.removeAllNonStableElements();
        removedElements.forEach(e => projector.elements_preview.unshift(e));

        // Add last element
        if (lastElement) {
            projector.addElement(lastElement);
        }
        await this.projectRequest(projector, projector.elements, projector.elements_preview, null, true);
    }

    public async savePreview(projector: Projector): Promise<void> {
        await this.projectRequest(projector, null, projector.elements_preview);
    }

    public async addElementToPreview(projector: Projector, element: ProjectorElement): Promise<void> {
        projector.elements_preview.push(element);
        await this.projectRequest(projector, null, projector.elements_preview);
    }
}