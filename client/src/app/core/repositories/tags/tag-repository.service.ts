import { Injectable } from '@angular/core';

import { Tag } from 'app/shared/models/core/tag';
import { ViewTag } from 'app/site/tags/models/view-tag';
import { DataSendService } from '../../core-services/data-send.service';
import { DataStoreService } from '../../core-services/data-store.service';
import { BaseRepository } from '../base-repository';
import { Identifiable } from 'app/shared/models/base/identifiable';
import { CollectionStringMapperService } from '../../core-services/collectionStringMapper.service';
import { ViewModelStoreService } from 'app/core/core-services/view-model-store.service';
import { TranslateService } from '@ngx-translate/core';

/**
 * Repository Services for Tags
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
export class TagRepositoryService extends BaseRepository<ViewTag, Tag> {
    /**
     * Creates a TagRepository
     * Converts existing and incoming Tags to ViewTags
     * Handles CRUD using an observer to the DataStore
     *
     * @param DS DataStore
     * @param mapperService Maps collection strings to classes
     * @param dataSend sending changed objects
     */
    public constructor(
        protected DS: DataStoreService,
        mapperService: CollectionStringMapperService,
        viewModelStoreService: ViewModelStoreService,
        private dataSend: DataSendService,
        private translate: TranslateService
    ) {
        super(DS, mapperService, viewModelStoreService, Tag);
    }

    public getVerboseName = (plural: boolean = false) => {
        return this.translate.instant(plural ? 'Tags' : 'Tag');
    };

    protected createViewModel(tag: Tag): ViewTag {
        const viewTag = new ViewTag(tag);
        viewTag.getVerboseName = this.getVerboseName;
        return viewTag;
    }

    public async create(update: Tag): Promise<Identifiable> {
        const newTag = new Tag();
        newTag.patchValues(update);
        return await this.dataSend.createModel(newTag);
    }

    public async update(update: Partial<Tag>, viewTag: ViewTag): Promise<void> {
        const updateTag = new Tag();
        updateTag.patchValues(viewTag.tag);
        updateTag.patchValues(update);
        await this.dataSend.updateModel(updateTag);
    }

    public async delete(viewTag: ViewTag): Promise<void> {
        await this.dataSend.deleteModel(viewTag.tag);
    }
}
