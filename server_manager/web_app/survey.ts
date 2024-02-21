// Copyright 2020 The Outline Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import {sleep} from '../infrastructure/sleep';
import {Surveys} from '../model/survey';

export const DEFAULT_PROMPT_IMPRESSION_DELAY_MS = 3000;

export class OutlineSurveys implements Surveys {
  constructor(
    private view: polymer.Base,
    private storage: Storage = localStorage,
    private promptImpressionDelayMs: number = DEFAULT_PROMPT_IMPRESSION_DELAY_MS,
    private dataLimitsAvailabilityDate?: Date
  ) {}

  async presentDataLimitsEnabledSurvey() {
    if (this.isSurveyExpired(this.dataLimitsAvailabilityDate)) {
      return;
    }
    await this.presentSurvey(
      'dataLimitsEnabledSurvey',
      this.view.localize('survey-data-limits-title'),
      'https://docs.google.com/forms/d/e/1FAIpQLSeXQ5WUHXQHlF1Ul_ViX52GjTUPlrRB_7rhwbol3dKJfM4Kiw/viewform'
    );
  }

  async presentDataLimitsDisabledSurvey() {
    if (this.isSurveyExpired(this.dataLimitsAvailabilityDate)) {
      return;
    }
    await this.presentSurvey(
      'dataLimitsDisabledSurvey',
      this.view.localize('survey-data-limits-title'),
      'https://docs.google.com/forms/d/e/1FAIpQLSc2ZNx0C1a-alFlXLxhJ8jWk-WgcxqKilFoQ5ToI8HBOK9qRA/viewform'
    );
  }

  // Displays a survey dialog for`surveyId` with title `surveyTitle` and a link to `surveyLink`
  // after `promptImpressionDelayMs` has elapsed. Rate-limits the survey to once per user.
  private async presentSurvey(surveyId: string, surveyTitle: string, surveyLink: string) {
    if (this.storage.getItem(surveyId)) {
      return;
    }
    await sleep(this.promptImpressionDelayMs);
    this.view.open(surveyTitle, surveyLink);
    this.storage.setItem(surveyId, 'true');
  }

  // Returns whether `surveyAvailabilityDate` is in the past.
  private isSurveyExpired(surveyAvailabilityDate: Date | undefined) {
    const now = new Date();
    return surveyAvailabilityDate && now > surveyAvailabilityDate;
  }
}
