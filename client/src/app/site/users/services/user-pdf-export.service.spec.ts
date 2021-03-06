import { TestBed } from '@angular/core/testing';

import { UserPdfExportService } from './user-pdf-export.service';
import { E2EImportsModule } from 'e2e-imports.module';

describe('UserPdfExportService', () => {
    beforeEach(() =>
        TestBed.configureTestingModule({
            imports: [E2EImportsModule]
        })
    );

    it('should be created', () => {
        const service: UserPdfExportService = TestBed.get(UserPdfExportService);
        expect(service).toBeTruthy();
    });
});
