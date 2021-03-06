import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { ItemListSlideComponent } from './item-list-slide.component';
import { E2EImportsModule } from '../../../../e2e-imports.module';

describe('ItemListSlideComponent', () => {
    let component: ItemListSlideComponent;
    let fixture: ComponentFixture<ItemListSlideComponent>;

    beforeEach(async(() => {
        TestBed.configureTestingModule({
            imports: [E2EImportsModule],
            declarations: [ItemListSlideComponent]
        }).compileComponents();
    }));

    beforeEach(() => {
        fixture = TestBed.createComponent(ItemListSlideComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
