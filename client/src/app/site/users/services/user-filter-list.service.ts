import { Injectable } from '@angular/core';

import { BaseFilterListService, OsFilter } from 'app/core/ui-services/base-filter-list.service';
import { StorageService } from 'app/core/core-services/storage.service';
import { User } from 'app/shared/models/users/user';
import { ViewUser } from '../models/view-user';
import { GroupRepositoryService } from 'app/core/repositories/users/group-repository.service';
import { UserRepositoryService } from 'app/core/repositories/users/user-repository.service';

@Injectable({
    providedIn: 'root'
})
export class UserFilterListService extends BaseFilterListService<User, ViewUser> {
    protected name = 'User';

    private userGroupFilterOptions = {
        isActive: false,
        property: 'groups_id',
        label: 'User Group',
        options: []
    };

    public staticFilterOptions = [
        {
            property: 'is_present',
            label: 'Presence',
            isActive: false,
            options: [{ condition: true, label: 'Is present' }, { condition: false, label: 'Is not present' }]
        },
        {
            property: 'is_active',
            label: 'Active',
            isActive: false,
            options: [{ condition: true, label: 'Is active' }, { condition: false, label: 'Is not active' }]
        },
        {
            property: 'is_committee',
            label: 'Committee',
            isActive: false,
            options: [{ condition: true, label: 'Is a committee' }, { condition: false, label: 'Is not a committee' }]
        },
        {
            property: 'is_last_email_send',
            label: 'Last email send',
            isActive: false,
            options: [{ condition: true, label: 'Got an email' }, { condition: false, label: "Didn't get an email" }]
        }
    ];

    /**
     * getter for the filterOptions. Note that in this case, the options are
     * generated dynamically, as the options change with the datastore
     */
    public get filterOptions(): OsFilter[] {
        return [this.userGroupFilterOptions].concat(this.staticFilterOptions);
    }

    public constructor(store: StorageService, private groupRepo: GroupRepositoryService, repo: UserRepositoryService) {
        super(store, repo);
        this.subscribeGroups();
    }

    /**
     * Updates the filter according to existing groups.
     * TODO: Users with only the 'standard' group set appear in the model as items without groups_id. 'Standard'  filter is broken
     */
    public subscribeGroups(): void {
        this.groupRepo.getViewModelListObservable().subscribe(groups => {
            const groupOptions = [];
            groups.forEach(group => {
                groupOptions.push({
                    condition: group.id,
                    label: group.name,
                    isActive: false
                });
            });
            this.userGroupFilterOptions.options = groupOptions;
            this.updateFilterDefinitions(this.filterOptions);
        });
    }
}
