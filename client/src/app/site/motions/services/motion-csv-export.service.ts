import { Injectable } from '@angular/core';

import { TranslateService } from '@ngx-translate/core';

import { CsvExportService, CsvColumnDefinitionProperty } from 'app/core/ui-services/csv-export.service';
import { InfoToExport } from './motion-pdf.service';
import { ViewMotion } from '../models/view-motion';

/**
 * Exports CSVs for motions. Collect all CSV types here to have them in one place.
 */
@Injectable({
    providedIn: 'root'
})
export class MotionCsvExportService {
    /**
     * Does nothing.
     *
     * @param csvExport CsvExportService
     * @param translate TranslateService
     */
    public constructor(private csvExport: CsvExportService, private translate: TranslateService) {}

    /**
     * Export all motions as CSV
     *
     * @param motions Motions to export
     * @param contentToExport content properties to export
     * @param infoToExport meta info to export
     */
    public exportMotionList(motions: ViewMotion[], contentToExport: string[], infoToExport: InfoToExport[]): void {
        const propertyList = ['identifier', 'title'].concat(contentToExport, infoToExport);
        const exportProperties: CsvColumnDefinitionProperty<ViewMotion>[] = propertyList.map(option => {
            return { property: option } as CsvColumnDefinitionProperty<ViewMotion>;
        });

        this.csvExport.export(motions, exportProperties, this.translate.instant('Motions') + '.csv');
    }

    /**
     * Exports the call list.
     *
     * @param motions All motions in the CSV. They should be ordered by callListWeight correctly.
     */
    public exportCallList(motions: ViewMotion[]): void {
        this.csvExport.export(
            motions,
            [
                { label: 'Called', map: motion => (motion.sort_parent_id ? '' : motion.identifierOrTitle) },
                { label: 'Called with', map: motion => (!motion.sort_parent_id ? '' : motion.identifierOrTitle) },
                { label: 'submitters', map: motion => motion.submitters.map(s => s.short_name).join(',') },
                { property: 'title' },
                {
                    label: 'recommendation',
                    map: motion =>
                        motion.recommendation ? this.translate.instant(motion.recommendation.recommendation_label) : ''
                },
                { property: 'motion_block', label: 'Motion block' }
            ],
            this.translate.instant('Call list') + '.csv'
        );
    }

    public exportDummyMotion(): void {
        const headerRow = ['Identifier', 'Title', 'Text', 'Reason', 'Submitters', 'Category', 'Origin', 'Motion block'];
        const rows = [
            ['A1', 'Title 1', 'Text 1', 'Reason 1', 'Submitter A', 'Category A', 'Last Year Conference A', 'Block A'],
            ['B1', 'Title 2', 'Text 2', 'Reason 2', 'Submitter B', 'Category B', null, 'Block A'],
            [null, 'Title 3', 'Text 3', null, null, null, null, null]
        ];
        this.csvExport.dummyCSVExport(headerRow, rows, `${this.translate.instant('motions-example')}.csv`);
    }
}
