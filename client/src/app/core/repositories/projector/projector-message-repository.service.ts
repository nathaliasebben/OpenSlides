import { Injectable } from '@angular/core';
import { DataStoreService } from '../../core-services/data-store.service';
import { BaseRepository } from '../base-repository';
import { Identifiable } from 'app/shared/models/base/identifiable';
import { CollectionStringMapperService } from '../../core-services/collectionStringMapper.service';
import { ProjectorMessage } from 'app/shared/models/core/projector-message';
import { ViewProjectorMessage } from 'app/site/projector/models/view-projector-message';
import { ViewModelStoreService } from 'app/core/core-services/view-model-store.service';
import { TranslateService } from '@ngx-translate/core';
import { DataSendService } from 'app/core/core-services/data-send.service';

@Injectable({
    providedIn: 'root'
})
export class ProjectorMessageRepositoryService extends BaseRepository<ViewProjectorMessage, ProjectorMessage> {
    public constructor(
        DS: DataStoreService,
        mapperService: CollectionStringMapperService,
        viewModelStoreService: ViewModelStoreService,
        private translate: TranslateService,
        private dataSend: DataSendService
    ) {
        super(DS, mapperService, viewModelStoreService, ProjectorMessage);
    }

    public getVerboseName = (plural: boolean = false) => {
        return this.translate.instant(plural ? 'Messages' : 'Message');
    };

    protected createViewModel(message: ProjectorMessage): ViewProjectorMessage {
        const viewProjectorMessage = new ViewProjectorMessage(message);
        viewProjectorMessage.getVerboseName = this.getVerboseName;
        return viewProjectorMessage;
    }

    public async create(message: ProjectorMessage): Promise<Identifiable> {
        return await this.dataSend.createModel(message);
    }

    public async update(message: Partial<ProjectorMessage>, viewMessage: ViewProjectorMessage): Promise<void> {
        const update = viewMessage.projectormessage;
        update.patchValues(message);
        await this.dataSend.updateModel(update);
    }

    public async delete(viewMessage: ViewProjectorMessage): Promise<void> {
        await this.dataSend.deleteModel(viewMessage.projectormessage);
    }
}
