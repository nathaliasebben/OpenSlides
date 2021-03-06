import { OnDestroy } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { MatSnackBar, MatSnackBarRef, SimpleSnackBar } from '@angular/material';

import { TranslateService } from '@ngx-translate/core';

import { BaseComponent } from '../../base.component';
import { Subscription } from 'rxjs';

/**
 * A base class for all views. Implements a generic error handling by raising a snack bar
 * with the error. The error is dismissed, if the component is destroyed, so if the
 * view is leaved.
 */
export abstract class BaseViewComponent extends BaseComponent implements OnDestroy {
    /**
     * A reference to the current error snack bar.
     */
    private messageSnackBar: MatSnackBarRef<SimpleSnackBar>;

    /**
     * Subscriptions added to this list will be cleared 'on destroy'
     */
    protected subscriptions: Subscription[];

    /**
     * Constructor for bas elist views
     * @param titleService the title serivce, passed to the base component
     * @param translate the translate service, passed to the base component
     * @param matSnackBar the snack bar service. Needed for showing errors.
     */
    public constructor(titleService: Title, translate: TranslateService, private matSnackBar: MatSnackBar) {
        super(titleService, translate);
        this.subscriptions = [];
    }

    /**
     * Opens the snack bar with the given message.
     * This snack bar will only dismiss if the user clicks the 'OK'-button.
     */
    protected raiseWarning = (message: string): void => {
        this.messageSnackBar = this.matSnackBar.open(message, this.translate.instant('OK'));
    };

    /**
     * Opens an error snack bar with the given error message.
     * This is implemented as an arrow function to capture the called `this`. You can use this function
     * as callback (`.then(..., this.raiseError)`) instead of doing `this.raiseError.bind(this)`.
     * @param message The message to show.
     */
    protected raiseError = (message: string): void => {
        this.messageSnackBar = this.matSnackBar.open(message, this.translate.instant('OK'), {
            duration: 0
        });
    };

    /**
     * Function to manually close the snack bar if it will not automatically close
     * or it should close in a previous step.
     */
    protected closeSnackBar(): void {
        if (this.matSnackBar) {
            this.matSnackBar.dismiss();
        }
    }

    /**
     * To catch swipe gestures.
     * Should be overwritten by children which need swipe gestures
     */
    protected swipe(e: TouchEvent, when: string): void {}

    /**
     * automatically dismisses the error snack bar and clears subscriptions
     * if the component is destroyed.
     */
    public ngOnDestroy(): void {
        if (this.messageSnackBar) {
            this.messageSnackBar.dismiss();
        }

        if (this.subscriptions.length > 0) {
            for (const sub of this.subscriptions) {
                sub.unsubscribe();
            }
        }
    }
}
