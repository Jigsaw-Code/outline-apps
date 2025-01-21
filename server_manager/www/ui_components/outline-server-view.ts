/*
  Copyright 2018 The Outline Authors

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/
import '@polymer/paper-dialog/paper-dialog';
import '@polymer/iron-icons/iron-icons';
import '@polymer/iron-pages/iron-pages';
import '@polymer/iron-icons/editor-icons';
import '@polymer/iron-icons/social-icons';
import '@polymer/paper-icon-button/paper-icon-button';
import '@polymer/paper-item/paper-item';
import '@polymer/paper-listbox/paper-listbox';
import '@polymer/paper-menu-button/paper-menu-button';
import '@polymer/paper-progress/paper-progress';
import '@polymer/paper-tabs/paper-tabs';
import '@polymer/paper-tooltip/paper-tooltip';
import './cloud-install-styles';
import './outline-iconset';
import './outline-help-bubble';
import './outline-metrics-option-dialog';
import './outline-server-progress-step';
import './outline-server-settings';
import './outline-share-dialog';
import './outline-sort-span';
import '../views/server_view/server_stat_grid';
import '../views/server_view/server_stat_card';
import {html, PolymerElement} from '@polymer/polymer';
import type {PolymerElementProperties} from '@polymer/polymer/interfaces';
import type {DomRepeat} from '@polymer/polymer/lib/elements/dom-repeat';
import {DirMixin} from '@polymer/polymer/lib/mixins/dir-mixin';

import {getCloudIcon} from './cloud-assets';
import type {OutlineHelpBubble} from './outline-help-bubble';
import type {OutlineServerSettings} from './outline-server-settings';
import type {CloudLocation} from '../../model/location';
import type {AccessKeyId} from '../../model/server';
import * as formatting from '../data_formatting';
import {getShortName} from '../location_formatting';

export const MY_CONNECTION_USER_ID = '0';

const progressBarMaxWidthPx = 72;

// Makes an CustomEvent that bubbles up beyond the shadow root.
function makePublicEvent(eventName: string, detail?: object) {
  const params: CustomEventInit = {bubbles: true, composed: true};
  if (detail !== undefined) {
    params.detail = detail;
  }
  return new CustomEvent(eventName, params);
}

function compare<T>(a: T, b: T): -1 | 0 | 1 {
  if (a < b) {
    return -1;
  } else if (a > b) {
    return 1;
  }
  return 0;
}

interface KeyRowEvent extends Event {
  model: {index: number; item: DisplayAccessKey};
}

/**
 * Allows using an optional number as a boolean value without 0 being falsey.
 * @returns True if x is neither null nor undefined
 */
function exists(x: number): boolean {
  return x !== null && x !== undefined;
}

/** An access key to be displayed */
export type DisplayAccessKey = {
  id: string;
  placeholderName: string;
  name: string;
  accessUrl: string;
  transferredBytes: number;
  /** The data limit assigned to the key, if it exists. */
  dataLimitBytes?: number;
  dataLimit?: formatting.DisplayDataAmount;
};

export class ServerView extends DirMixin(PolymerElement) {
  static get template() {
    return html`
      <style include="cloud-install-styles"></style>
      <style>
        .container {
          display: flex;
          flex-direction: column;
          color: var(--light-gray);
        }
        #managementView,
        #unreachableView {
          padding: 24px;
        }
        .tabs-container {
          display: flex;
          flex-direction: row;
          border-bottom: 1px solid var(--border-color);
        }
        .tabs-spacer {
          flex: 2;
        }
        paper-tabs {
          --paper-tabs-selection-bar-color: var(--primary-green);
          --paper-tab-ink: var(--primary-green);
          --paper-tab-content-unselected {
            color: var(--dark-gray);
          }
        }
        div[name='connections'],
        div[name='settings'],
        .access-key-list {
          margin-top: 24px;
        }
        .server-header {
          display: flex;
          flex-direction: column;
          margin: 24px 0;
        }
        .server-name {
          display: flex;
          flex-direction: row;
          align-items: center;
          justify-content: space-between;
        }
        .server-name h3 {
          font-size: 36px;
          font-weight: 400;
          color: #ffffff;
          flex: 11;
          margin: 0 0 6px 0;
        }
        .server-location,
        .unreachable-server paper-button {
          color: var(--medium-gray);
        }
        .unreachable-server {
          flex-direction: column;
          align-items: center;
          margin-top: 24px;
          padding: 72px 48px;
        }
        .unreachable-server p {
          line-height: 22px;
          max-width: 50ch;
          text-align: center;
          color: var(--medium-gray);
        }
        .unreachable-server .button-container {
          padding: 24px 0;
        }
        .unreachable-server paper-button.try-again-btn {
          color: var(--primary-green);
        }
        .server-img {
          width: 142px;
          height: 142px;
          margin: 24px;
        }
        .stats-container {
          display: flex;
          flex-direction: row;
          margin: 0 -8px;
        }
        .stats-card {
          flex-direction: column;
          flex: 1;
          margin: 0 8px;
        }
        .stats {
          margin: 30px 0 18px 0;
          color: #fff;
          white-space: nowrap;
        }
        .stats > * {
          font-weight: 300;
          display: inline-block;
          margin: 0;
        }
        .stats h3 {
          font-size: 48px;
        }
        .stats p,
        .stats-card p {
          margin: 0;
          font-size: 14px;
          font-weight: normal;
        }
        @media (max-width: 938px) {
          /* Reduce the cards' size so they fit comfortably on small displays. */
          .stats {
            margin-top: 24px;
          }
          .stats h3 {
            font-size: 42px;
          }
          .stats-card p {
            font-size: 12px;
          }
        }
        .transfer-stats .stats,
        .transfer-stats .stats p {
          color: var(--primary-green);
        }
        .stats-card p,
        .stats-card iron-icon {
          color: var(--medium-gray);
        }
        .access-key-list {
          flex-direction: column;
          padding: 24px 16px 24px 30px;
        }
        .access-key-row {
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 15px 0;
        }
        .header-row {
          font-size: 12px;
          color: var(--medium-gray);
          margin-bottom: 12px;
        }
        .header-row paper-button {
          color: white;
          height: 32px;
          font-size: 13px;
          padding: 0 28px 0px 28px;
          background-color: #00bfa5;
          margin: 0px 12px 0px 96px;
          height: 36px;
        }
        .header-row-spacer {
          /* 24px (share icon) + 40px (overflow menu) + 8px (margin) */
          min-width: 72px;
        }
        .measurement-container {
          display: flex;
          flex: 4;
          align-items: center;
        }
        .measurement-container paper-progress {
          max-width: 72px;
          margin: 0 24px 0 12px;
          --paper-progress-height: 8px;
          --paper-progress-active-color: var(--primary-green);
        }
        .measurement-container paper-progress.data-limits {
          border: 1px solid var(--primary-green);
          border-radius: 2px;
        }
        @media (max-width: 640px) {
          .measurement-container paper-progress {
            width: 48px;
          }
        }
        paper-progress.data-limits:hover {
          cursor: pointer;
        }
        .measurement {
          /* Space the usage bars evenly */
          width: 19ch;
          /* We don't want numbers separated from their units */
          white-space: nowrap;
          font-size: 14px;
          color: var(--medium-gray);
          line-height: 24px;
        }
        .access-key-container {
          display: flex;
          flex: 4;
          align-items: center;
        }
        .sort-icon {
          /* Disable click events on the sorting icons, so that the event gets propagated to the
           parent, which defines the dataset elements needed for displaying the icon. */
          pointer-events: none;
        }
        .access-key-icon {
          width: 42px;
          height: 42px;
          margin-right: 18px;
        }
        .access-key-name {
          display: flex;
          flex-direction: column;
          font-weight: 500;
          flex: 1;
        }
        input.access-key-name {
          font-family: inherit;
          font-size: inherit;
          border-top: none;
          border-left: none;
          border-right: none;
          border-bottom: 1px solid transparent;
          border-radius: 2px;
          padding: 4px 8px;
          position: relative;
          left: -8px; /* Align with padding */
          background: var(--background-contrast-color);
          color: var(--light-gray);
        }
        input.access-key-name::placeholder {
          opacity: inherit;
          color: inherit;
        }
        input.access-key-name:hover {
          border-bottom-color: var(--border-color);
        }
        input.access-key-name:focus {
          border-bottom-color: var(--primary-green);
          border-radius: 0px;
          outline: none;
          font-weight: normal;
        }
        .overflow-menu {
          display: flex;
          justify-content: flex-end;
          padding: 0px;
          min-width: 40px;
          margin-left: 8px;
          color: var(--medium-gray);
        }
        .overflow-menu paper-item {
          cursor: pointer;
        }
        paper-item {
          font-size: 14px;
        }
        paper-listbox iron-icon {
          margin-right: 10px;
          width: 18px;
        }
        paper-dropdown {
          box-shadow: 0px 0px 20px #999999;
        }
        #addAccessKeyButton {
          background: var(--primary-green);
          color: #fff;
          border-radius: 50%;
        }
        .actions {
          flex: 1;
          display: flex;
          justify-content: flex-end;
          align-items: center;
          text-align: end;
        }
        .connect-button,
        .share-button {
          color: white;
          padding: 0;
          margin: 0;
          height: 24px;
          width: 24px;
        }
        .add-new-key {
          color: var(--primary-green);
          cursor: pointer;
        }
        outline-help-bubble {
          text-align: center;
        }
        outline-help-bubble h3 {
          padding-bottom: 0;
          font-weight: 500;
          line-height: 28px;
          font-size: 16px;
          margin: 0px 0px 12px 0px;
        }
        outline-help-bubble img {
          width: 76px;
          height: auto;
          margin: 12px 0px 24px 0px;
        }
        .cloud-icon {
          opacity: 0.54;
        }
        .flex-1 {
          flex: 1;
        }

        div[name='metrics'] {
          margin-top: 15px;
        }

        :host {
          --server-stat-card-background: var(--background-contrast-color);
          --server-stat-card-foreground: var(--medium-gray);
          --server-stat-card-highlight: var(--light-gray);
        }
        /* Mirror icons */
        :host(:dir(rtl)) iron-icon,
        :host(:dir(rtl)) .share-button,
        :host(:dir(rtl)) .access-key-icon {
          transform: scaleX(-1);
        }
      </style>

      <div class="container">
        <iron-pages
          id="pages"
          attr-for-selected="id"
          selected="[[selectedPage]]"
        >
          <outline-server-progress-step
            id="progressView"
            server-name="[[serverName]]"
            localize="[[localize]]"
            progress="[[installProgress]]"
          ></outline-server-progress-step>
          <div id="unreachableView">${this.unreachableViewTemplate}</div>
          <div id="managementView">${this.managementViewTemplate}</div>
        </iron-pages>
      </div>

      <outline-help-bubble
        id="getConnectedHelpBubble"
        vertical-align="bottom"
        horizontal-align="right"
      >
        <img src="images/connect-tip-2x.png" />
        <h3>[[localize('server-help-connection-title')]]</h3>
        <p>[[localize('server-help-connection-description')]]</p>
        <paper-button on-tap="_closeGetConnectedHelpBubble"
          >[[localize('server-help-connection-ok')]]</paper-button
        >
      </outline-help-bubble>
      <outline-help-bubble
        id="addAccessKeyHelpBubble"
        vertical-align="bottom"
        horizontal-align="left"
      >
        <img src="images/key-tip-2x.png" />
        <h3>[[localize('server-help-access-key-title')]]</h3>
        <p>[[localize('server-help-access-key-description')]]</p>
        <paper-button on-tap="_closeAddAccessKeyHelpBubble"
          >[[localize('server-help-access-key-next')]]</paper-button
        >
      </outline-help-bubble>
      <outline-help-bubble
        id="dataLimitsHelpBubble"
        vertical-align="top"
        horizontal-align="right"
      >
        <h3>[[localize('data-limits-dialog-title')]]</h3>
        <p>[[localize('data-limits-dialog-text')]]</p>
        <paper-button on-tap="_closeDataLimitsHelpBubble"
          >[[localize('ok')]]</paper-button
        >
      </outline-help-bubble>
    `;
  }

  static get unreachableViewTemplate() {
    return html` <div class="server-header">
        <div class="server-name">
          <h3>[[serverName]]</h3>
        </div>
      </div>
      <div class="card-section unreachable-server">
        <img class="server-img" src="images/server-unreachable.png" />
        <h3>[[localize('server-unreachable')]]</h3>
        <p></p>
        <div>[[localize('server-unreachable-description')]]</div>
        <span hidden$="[[_isServerManaged(cloudId)]]"
          >[[localize('server-unreachable-managed-description')]]</span
        >
        <span hidden$="[[!_isServerManaged(cloudId)]]"
          >[[localize('server-unreachable-manual-description')]]</span
        >
        <div class="button-container">
          <paper-button
            on-tap="removeServer"
            hidden$="[[_isServerManaged(cloudId)]]"
            >[[localize('server-remove')]]</paper-button
          >
          <paper-button
            on-tap="destroyServer"
            hidden$="[[!_isServerManaged(cloudId)]]"
            >[[localize('server-destroy')]]</paper-button
          >
          <paper-button on-tap="retryDisplayingServer" class="try-again-btn"
            >[[localize('retry')]]</paper-button
          >
        </div>
      </div>`;
  }

  static get managementViewTemplate() {
    return html` <div class="server-header">
        <div class="server-name">
          <h3>[[serverName]]</h3>
          <paper-menu-button
            horizontal-align="right"
            class="overflow-menu flex-1"
            close-on-activate=""
            no-animations=""
            dynamic-align=""
            no-overlap=""
          >
            <paper-icon-button
              icon="more-vert"
              slot="dropdown-trigger"
            ></paper-icon-button>
            <paper-listbox slot="dropdown-content">
              <paper-item
                hidden$="[[!_isServerManaged(cloudId)]]"
                on-tap="destroyServer"
              >
                <iron-icon icon="icons:remove-circle-outline"></iron-icon
                >[[localize('server-destroy')]]
              </paper-item>
              <paper-item
                hidden$="[[_isServerManaged(cloudId)]]"
                on-tap="removeServer"
              >
                <iron-icon icon="icons:remove-circle-outline"></iron-icon
                >[[localize('server-remove')]]
              </paper-item>
            </paper-listbox>
          </paper-menu-button>
        </div>
        <div class="server-location">
          [[getShortName(cloudLocation, localize)]]
        </div>
      </div>
      <div class="tabs-container">
        <div class="tabs-spacer"></div>
        <paper-tabs
          selected="{{selectedTab}}"
          attr-for-selected="name"
          noink=""
        >
          <template is="dom-if" if="{{!featureFlags.serverMetricsTab}}">
            <paper-tab name="connections"
              >[[localize('server-connections')]]</paper-tab
            >
          </template>
          <template is="dom-if" if="{{featureFlags.serverMetricsTab}}">
            <paper-tab name="connections">
              [[localize('server-access-key-tab', accessKeyRows.length)]]
            </paper-tab>
            <paper-tab name="metrics">[[localize('server-metrics')]]</paper-tab>
          </template>
          <paper-tab name="settings" id="settingsTab"
            >[[localize('server-settings')]]</paper-tab
          >
        </paper-tabs>
      </div>
      <iron-pages
        selected="[[selectedTab]]"
        attr-for-selected="name"
        on-selected-changed="_selectedTabChanged"
      >
        <div name="connections">
          <template is="dom-if" if="{{!featureFlags.serverMetricsTab}}">
            <div class="stats-container">
              <div class="stats-card transfer-stats card-section">
                <iron-icon icon="icons:swap-horiz"></iron-icon>
                <div class="stats">
                  <h3>
                    [[_formatInboundBytesValue(totalInboundBytes, language)]]
                  </h3>
                  <p>
                    [[_formatInboundBytesUnit(totalInboundBytes, language)]]
                  </p>
                </div>
                <p>[[localize('server-data-transfer')]]</p>
              </div>
              <div
                hidden$="[[!monthlyOutboundTransferBytes]]"
                class="stats-card card-section"
              >
                <div>
                  <img class="cloud-icon" src="[[getCloudIcon(cloudId)]]" />
                </div>
                <div class="stats">
                  <h3>
                    [[_computeManagedServerUtilizationPercentage(totalInboundBytes,
                    monthlyOutboundTransferBytes)]]
                  </h3>
                  <p>
                    /[[_formatBytesTransferred(monthlyOutboundTransferBytes,
                    language)]]
                  </p>
                </div>
                <p>[[localize('server-data-used')]]</p>
              </div>
              <div class="stats-card card-section">
                <iron-icon icon="outline-iconset:key"></iron-icon>
                <div class="stats">
                  <h3>[[accessKeyRows.length]]</h3>
                  <p>[[localize('server-keys')]]</p>
                </div>
                <p>[[localize('server-access')]]</p>
              </div>
            </div>
          </template>

          <div class="access-key-list card-section">
            <!-- header row -->
            <div class="access-key-row header-row">
              <outline-sort-span
                class="access-key-container"
                direction="[[_computeColumnDirection('name', accessKeySortBy, accessKeySortDirection)]]"
                on-tap="_setSortByOrToggleDirection"
                data-sort-by="name"
              >
                [[localize('server-access-keys')]]
              </outline-sort-span>
              <outline-sort-span
                class="measurement-container"
                direction="[[_computeColumnDirection('usage', accessKeySortBy, accessKeySortDirection)]]"
                on-tap="_setSortByOrToggleDirection"
                data-sort-by="usage"
              >
                [[localize('server-usage')]]
              </outline-sort-span>
              <span class="flex-1 header-row-spacer"></span>
            </div>
            <div id="accessKeysContainer">
              <!-- rows for each access key -->
              <template
                is="dom-repeat"
                items="{{accessKeyRows}}"
                sort="{{_sortAccessKeys(accessKeySortBy, accessKeySortDirection)}}"
                observe="name transferredBytes"
              >
                <!-- TODO(alalama): why is observe not responding to rename? -->
                <div class="access-key-row">
                  <span class="access-key-container">
                    <img class="access-key-icon" src="images/key-avatar.svg" />
                    <input
                      type="text"
                      class="access-key-name"
                      id$="access-key-[[item.id]]"
                      placeholder="{{item.placeholderName}}"
                      value="[[item.name]]"
                      on-blur="_handleNameInputBlur"
                      on-keydown="_handleNameInputKeyDown"
                    />
                  </span>
                  <span class="measurement-container">
                    <span class="measurement">
                      <bdi
                        >[[_formatBytesTransferred(item.transferredBytes,
                        language, "...")]]</bdi
                      >
                      /
                      <bdi
                        >[[_formatDataLimitForKey(item, language,
                        localize)]]</bdi
                      >
                    </span>
                    <paper-progress
                      max="[[_getRelevantTransferAmountForKey(item)]]"
                      value="[[item.transferredBytes]]"
                      class$="[[_computePaperProgressClass(item)]]"
                      style$="[[_computeProgressWidthStyling(item, baselineDataTransfer)]]"
                    ></paper-progress>
                    <paper-tooltip
                      animation-delay="0"
                      offset="0"
                      position="top"
                      hidden$="[[!_activeDataLimitForKey(item)]]"
                    >
                      [[_getDataLimitsUsageString(item, language, localize)]]
                    </paper-tooltip>
                  </span>
                  <span class="actions">
                    <span class="flex-1">
                      <paper-icon-button
                        icon="outline-iconset:share"
                        class="share-button"
                        on-tap="_handleShareCodePressed"
                      ></paper-icon-button>
                    </span>
                    <span class="flex-1">
                      <paper-menu-button
                        horizontal-align="right"
                        class="overflow-menu"
                        close-on-activate=""
                        no-animations=""
                        no-overlap=""
                        dynamic-align=""
                      >
                        <paper-icon-button
                          icon="more-vert"
                          slot="dropdown-trigger"
                        ></paper-icon-button>
                        <paper-listbox slot="dropdown-content">
                          <paper-item on-tap="_handleRenameAccessKeyPressed">
                            <iron-icon icon="icons:create"></iron-icon
                            >[[localize('server-access-key-rename')]]
                          </paper-item>
                          <paper-item on-tap="_handleRemoveAccessKeyPressed">
                            <iron-icon icon="icons:delete"></iron-icon
                            >[[localize('remove')]]
                          </paper-item>
                          <paper-item
                            hidden$="[[!hasPerKeyDataLimitDialog]]"
                            on-tap="_handleShowPerKeyDataLimitDialogPressed"
                          >
                            <iron-icon
                              icon="icons:perm-data-setting"
                            ></iron-icon
                            >[[localize('data-limit')]]
                          </paper-item>
                        </paper-listbox>
                      </paper-menu-button>
                    </span>
                  </span>
                </div>
              </template>
            </div>
            <!-- add key button -->
            <div class="access-key-row" id="addAccessKeyRow">
              <span class="access-key-container">
                <paper-icon-button
                  icon="icons:add"
                  on-tap="_handleAddAccessKeyPressed"
                  id="addAccessKeyButton"
                  class="access-key-icon"
                ></paper-icon-button>
                <div class="add-new-key" on-tap="_handleAddAccessKeyPressed">
                  [[localize('server-access-key-new')]]
                </div>
              </span>
            </div>
          </div>
        </div>
        <template is="dom-if" if="{{featureFlags.serverMetricsTab}}">
          <div name="metrics">
            <server-stat-grid
              columns="3"
              rows="1"
              stats="[[serverMetrics]]"
            ></server-stat-grid>
          </div>
        </template>
        <div name="settings">
          <outline-server-settings
            id="serverSettings"
            metrics-id="[[metricsId]]"
            server-hostname="[[serverHostname]]"
            server-name="[[serverName]]"
            server-version="[[serverVersion]]"
            is-hostname-editable="[[isHostnameEditable]]"
            server-management-api-url="[[serverManagementApiUrl]]"
            server-port-for-new-access-keys="[[serverPortForNewAccessKeys]]"
            is-access-key-port-editable="[[isAccessKeyPortEditable]]"
            default-data-limit="[[_computeDisplayDataLimit(defaultDataLimitBytes)]]"
            is-default-data-limit-enabled="{{isDefaultDataLimitEnabled}}"
            supports-default-data-limit="[[supportsDefaultDataLimit]]"
            show-feature-metrics-disclaimer="[[showFeatureMetricsDisclaimer]]"
            server-creation-date="[[serverCreationDate]]"
            server-monthly-cost="[[monthlyCost]]"
            server-monthly-transfer-limit="[[_formatBytesTransferred(monthlyOutboundTransferBytes, language)]]"
            cloud-id="[[cloudId]]"
            cloud-location="[[cloudLocation]]"
            metrics-enabled="[[metricsEnabled]]"
            language="[[language]]"
            localize="[[localize]]"
          >
          </outline-server-settings>
        </div>
      </iron-pages>`;
  }

  static get is() {
    return 'outline-server-view';
  }

  static get properties(): PolymerElementProperties {
    return {
      metricsId: String,
      serverId: String,
      serverName: String,
      serverHostname: String,
      serverVersion: String,
      isHostnameEditable: Boolean,
      serverManagementApiUrl: String,
      serverPortForNewAccessKeys: Number,
      isAccessKeyPortEditable: Boolean,
      serverCreationDate: Date,
      cloudLocation: Object,
      cloudId: String,
      defaultDataLimitBytes: Number,
      isDefaultDataLimitEnabled: Boolean,
      supportsDefaultDataLimit: Boolean,
      showFeatureMetricsDisclaimer: Boolean,
      installProgress: Number,
      isServerReachable: Boolean,
      retryDisplayingServer: Function,
      totalInboundBytes: Number,
      totalUserHours: Number,
      totalDevices: Number,
      baselineDataTransfer: Number,
      accessKeyRows: Array,
      hasNonAdminAccessKeys: Boolean,
      metricsEnabled: Boolean,
      monthlyOutboundTransferBytes: Number,
      monthlyCost: Number,
      accessKeySortBy: String,
      accessKeySortDirection: Number,
      language: String,
      localize: Function,
      selectedPage: String,
      selectedTab: String,
      featureFlags: Object,
      serverMetrics: {
        type: Array,
        computed:
          '_computeServerMetrics(totalDevices, totalUserHours, totalInboundBytes, language)',
      },
    };
  }

  static get observers() {
    return ['_accessKeysAddedOrRemoved(accessKeyRows.splices)'];
  }

  serverId = '';
  metricsId = '';
  serverName = '';
  serverHostname = '';
  serverVersion = '';
  isHostnameEditable = false;
  serverManagementApiUrl = '';
  serverPortForNewAccessKeys: number = null;
  isAccessKeyPortEditable = false;
  serverCreationDate = new Date(0);
  cloudLocation: CloudLocation = null;
  cloudId = '';
  readonly getShortName = getShortName;
  readonly getCloudIcon = getCloudIcon;
  defaultDataLimitBytes: number = null;
  isDefaultDataLimitEnabled = false;
  hasPerKeyDataLimitDialog = false;
  /** Whether the server supports default data limits. */
  supportsDefaultDataLimit = false;
  showFeatureMetricsDisclaimer = false;
  installProgress = 0;
  isServerReachable = false;
  /** Callback for retrying to display an unreachable server. */
  retryDisplayingServer: () => void = null;
  totalInboundBytes = 0;
  totalUserHours = 0;
  totalDevices = 0;
  /** The number to which access key transfer amounts are compared for progress bar display */
  baselineDataTransfer = Number.POSITIVE_INFINITY;
  accessKeyRows: DisplayAccessKey[] = [];
  hasNonAdminAccessKeys = false;
  metricsEnabled = false;
  // Initialize monthlyOutboundTransferBytes and monthlyCost to 0, so they can
  // be bound to hidden attributes.  Initializing to undefined does not
  // cause hidden$=... expressions to be evaluated and so elements may be
  // shown incorrectly.  See:
  //   https://stackoverflow.com/questions/33700125/polymer-1-0-hidden-attribute-negate-operator
  //   https://www.polymer-project.org/1.0/docs/devguide/data-binding.html
  monthlyOutboundTransferBytes = 0;
  monthlyCost = 0;
  accessKeySortBy = 'name';
  /** The direction to sort: 1 == ascending, -1 == descending */
  accessKeySortDirection: -1 | 1 = 1;
  language = 'en';
  localize: (msgId: string, ...params: string[]) => string = null;
  selectedPage: 'progressView' | 'unreachableView' | 'managementView' =
    'managementView';
  selectedTab: 'connections' | 'settings' = 'connections';
  featureFlags = {serverMetricsTab: false};

  addAccessKey(accessKey: DisplayAccessKey) {
    // TODO(fortuna): Restore loading animation.
    // TODO(fortuna): Restore highlighting.
    this.push('accessKeyRows', accessKey);
    // Force render the access key list so that the input is present in the DOM
    this.$.accessKeysContainer.querySelector<DomRepeat>('dom-repeat').render();
    const input = this.shadowRoot.querySelector<HTMLInputElement>(
      `#access-key-${accessKey.id}`
    );
    input.select();
  }

  removeAccessKey(accessKeyId: string) {
    for (let ui = 0; ui < this.accessKeyRows.length; ui++) {
      if (this.accessKeyRows[ui].id === accessKeyId) {
        this.splice('accessKeyRows', ui, 1);
        return;
      }
    }
  }

  updateAccessKeyRow(accessKeyId: string, fields: object) {
    let newAccessKeyRow;
    for (const accessKeyRowIndex in this.accessKeyRows) {
      if (this.accessKeyRows[accessKeyRowIndex].id === accessKeyId) {
        newAccessKeyRow = Object.assign(
          {},
          this.get(['accessKeyRows', accessKeyRowIndex]),
          fields
        );
        this.set(['accessKeyRows', accessKeyRowIndex], newAccessKeyRow);
        return;
      }
    }
  }

  // Help bubbles should be shown after this outline-server-view
  // is on the screen (e.g. selected in iron-pages). If help bubbles
  // are initialized before this point, setPosition will not work and
  // they will appear in the top left of the view.
  showGetConnectedHelpBubble() {
    return this._showHelpBubble(
      'getConnectedHelpBubble',
      'accessKeysContainer'
    );
  }

  showAddAccessKeyHelpBubble() {
    return this._showHelpBubble(
      'addAccessKeyHelpBubble',
      'addAccessKeyRow',
      'down',
      'left'
    );
  }

  showDataLimitsHelpBubble() {
    return this._showHelpBubble(
      'dataLimitsHelpBubble',
      'settingsTab',
      'up',
      'right'
    );
  }

  /** Returns the UI access key with the given ID. */
  findUiKey(id: AccessKeyId): DisplayAccessKey {
    return this.accessKeyRows.find(key => key.id === id);
  }

  _computeServerMetrics(
    totalDevices: number,
    totalUserHours: number,
    totalInboundBytes: number,
    language: string
  ) {
    return [
      {
        icon: 'devices',
        name: this.localize('server-metrics-average-devices'),
        value: totalDevices.toFixed(2),
      },
      {
        icon: 'timer',
        name: this.localize('server-metrics-user-hours'),
        units: this._formatHourUnits(totalUserHours, language),
        value: this._formatHourValue(totalUserHours, language),
      },
      {
        icon: 'swap_horiz',
        name: this.localize('server-metrics-data-transferred'),
        units: this._formatInboundBytesUnit(totalInboundBytes, language),
        value: this._formatInboundBytesValue(totalInboundBytes, language),
      },
    ];
  }

  _closeAddAccessKeyHelpBubble() {
    (this.$.addAccessKeyHelpBubble as OutlineHelpBubble).hide();
  }

  _closeGetConnectedHelpBubble() {
    (this.$.getConnectedHelpBubble as OutlineHelpBubble).hide();
  }

  _closeDataLimitsHelpBubble() {
    (this.$.dataLimitsHelpBubble as OutlineHelpBubble).hide();
  }

  _handleAddAccessKeyPressed() {
    this.dispatchEvent(makePublicEvent('AddAccessKeyRequested'));
    (this.$.addAccessKeyHelpBubble as OutlineHelpBubble).hide();
  }

  _handleNameInputKeyDown(event: KeyRowEvent & KeyboardEvent) {
    const input = event.target as HTMLInputElement;
    if (event.key === 'Escape') {
      const accessKey = event.model.item;
      input.value = accessKey.name;
      input.blur();
    } else if (event.key === 'Enter') {
      input.blur();
    }
  }

  _handleNameInputBlur(event: KeyRowEvent & FocusEvent) {
    const input = event.target as HTMLInputElement;
    const accessKey = event.model.item;
    const displayName = input.value;
    if (displayName === accessKey.name) {
      return;
    }
    input.disabled = true;
    this.dispatchEvent(
      makePublicEvent('RenameAccessKeyRequested', {
        accessKeyId: accessKey.id,
        newName: displayName,
        entry: {
          commitName: () => {
            input.disabled = false;
            // Update accessKeyRows so the UI is updated.
            this.accessKeyRows = this.accessKeyRows.map(row => {
              if (row.id !== accessKey.id) {
                return row;
              }
              return {...row, name: displayName};
            });
          },
          revertName: () => {
            input.value = accessKey.name;
            input.disabled = false;
          },
        },
      })
    );
  }

  _handleShowPerKeyDataLimitDialogPressed(event: KeyRowEvent) {
    const accessKey = event.model?.item;
    const keyId = accessKey.id;
    const keyDataLimitBytes = accessKey.dataLimitBytes;
    const keyName = accessKey.name || accessKey.placeholderName;
    const defaultDataLimitBytes = this.isDefaultDataLimitEnabled
      ? this.defaultDataLimitBytes
      : undefined;
    const serverId = this.serverId;
    this.dispatchEvent(
      makePublicEvent('OpenPerKeyDataLimitDialogRequested', {
        keyId,
        keyDataLimitBytes,
        keyName,
        serverId,
        defaultDataLimitBytes,
      })
    );
  }

  _handleRenameAccessKeyPressed(event: KeyRowEvent) {
    const input = this.$.accessKeysContainer.querySelectorAll<HTMLInputElement>(
      '.access-key-row .access-key-container > input'
    )[event.model.index];
    // This needs to be deferred because the closing menu messes up with the focus.
    window.setTimeout(() => {
      input.focus();
    }, 0);
  }

  _handleShareCodePressed(event: KeyRowEvent) {
    const accessKey = event.model.item;
    this.dispatchEvent(
      makePublicEvent('OpenShareDialogRequested', {
        accessKey: accessKey.accessUrl,
      })
    );
  }

  _handleRemoveAccessKeyPressed(e: KeyRowEvent) {
    const accessKey = e.model.item;
    this.dispatchEvent(
      makePublicEvent('RemoveAccessKeyRequested', {accessKeyId: accessKey.id})
    );
  }

  _formatDataLimitForKey(
    key: DisplayAccessKey,
    language: string,
    localize: Function
  ) {
    return this._formatDisplayDataLimit(
      this._activeDataLimitForKey(key),
      language,
      localize
    );
  }

  _computeDisplayDataLimit(limit?: number) {
    return formatting.bytesToDisplayDataAmount(limit);
  }

  _formatDisplayDataLimit(limit: number, language: string, localize: Function) {
    return exists(limit)
      ? formatting.formatBytes(limit, language)
      : localize('no-data-limit');
  }

  _formatInboundBytesUnit(totalBytes: number, language: string) {
    // This happens during app startup before we set the language
    if (!language) {
      return '';
    }
    return formatting.formatBytesParts(totalBytes, language).unit;
  }

  _formatInboundBytesValue(totalBytes: number, language: string) {
    // This happens during app startup before we set the language
    if (!language) {
      return '';
    }
    return formatting.formatBytesParts(totalBytes, language).value;
  }

  _formatHourUnits(hours: number, language: string) {
    // This happens during app startup before we set the language
    if (!language) {
      return '';
    }

    const formattedValue = this._formatHourValue(hours, language);
    const formattedValueAndUnit = new Intl.NumberFormat(language, {
      style: 'unit',
      unit: 'hour',
      unitDisplay: 'long',
    }).format(hours);

    return formattedValueAndUnit
      .split(formattedValue)
      .find(_ => _)
      .trim();
  }

  _formatHourValue(hours: number, language: string) {
    // This happens during app startup before we set the language
    if (!language) {
      return '';
    }
    return new Intl.NumberFormat(language, {
      unit: 'hour',
    }).format(hours);
  }

  _formatBytesTransferred(numBytes: number, language: string, emptyValue = '') {
    if (!numBytes) {
      // numBytes may not be set for manual servers, or may be 0 for
      // unused access keys.
      return emptyValue;
    }
    return formatting.formatBytes(numBytes, language);
  }

  _formatMonthlyCost(monthlyCost: number, language: string) {
    if (!monthlyCost) {
      return '';
    }
    return new Intl.NumberFormat(language, {
      style: 'currency',
      currency: 'USD',
      currencyDisplay: 'code',
    }).format(monthlyCost);
  }

  _computeManagedServerUtilizationPercentage(
    numBytes: number,
    monthlyLimitBytes: number
  ) {
    let utilizationPercentage = 0;
    if (monthlyLimitBytes && numBytes) {
      utilizationPercentage = Math.round((numBytes / monthlyLimitBytes) * 100);
    }
    if (document.documentElement.dir === 'rtl') {
      return `%${utilizationPercentage}`;
    }
    return `${utilizationPercentage}%`;
  }

  _accessKeysAddedOrRemoved(_changeRecord: unknown) {
    // Check for user key and regular access keys.
    let hasNonAdminAccessKeys = true;
    for (const ui in this.accessKeyRows) {
      if (this.accessKeyRows[ui].id === MY_CONNECTION_USER_ID) {
        hasNonAdminAccessKeys = false;
        break;
      }
    }
    this.hasNonAdminAccessKeys = hasNonAdminAccessKeys;
  }

  _selectedTabChanged() {
    if (this.selectedTab === 'settings') {
      this._closeAddAccessKeyHelpBubble();
      this._closeGetConnectedHelpBubble();
      this._closeDataLimitsHelpBubble();
      (this.$.serverSettings as OutlineServerSettings).setServerName(
        this.serverName
      );
    }
  }

  _showHelpBubble(
    helpBubbleId: string,
    positionTargetId: string,
    arrowDirection = 'down',
    arrowAlignment = 'right'
  ) {
    return new Promise(resolve => {
      const helpBubble = this.$[helpBubbleId] as OutlineHelpBubble;
      helpBubble.show(this.$[positionTargetId], arrowDirection, arrowAlignment);
      helpBubble.addEventListener('outline-help-bubble-dismissed', resolve);
    });
  }

  isRegularConnection(item: DisplayAccessKey) {
    return item.id !== MY_CONNECTION_USER_ID;
  }

  _computeColumnDirection(
    columnName: string,
    accessKeySortBy: string,
    accessKeySortDirection: -1 | 1
  ) {
    if (columnName === accessKeySortBy) {
      return accessKeySortDirection;
    }
    return 0;
  }

  _setSortByOrToggleDirection(e: MouseEvent) {
    const element = e.target as HTMLElement;
    const sortBy = element.dataset.sortBy;
    if (this.accessKeySortBy !== sortBy) {
      this.accessKeySortBy = sortBy;
      this.accessKeySortDirection = sortBy === 'usage' ? -1 : 1;
    } else {
      this.accessKeySortDirection *= -1;
    }
  }

  _sortAccessKeys(accessKeySortBy: string, accessKeySortDirection: -1 | 1) {
    if (accessKeySortBy === 'usage') {
      return (a: DisplayAccessKey, b: DisplayAccessKey) => {
        return (
          (a.transferredBytes - b.transferredBytes) * accessKeySortDirection
        );
      };
    }
    // Default to sorting by name.
    return (a: DisplayAccessKey, b: DisplayAccessKey) => {
      if (a.name && b.name) {
        return (
          compare(a.name.toUpperCase(), b.name.toUpperCase()) *
          accessKeySortDirection
        );
      } else if (a.name) {
        return -1;
      } else if (b.name) {
        return 1;
      } else {
        return 0;
      }
    };
  }

  destroyServer() {
    this.dispatchEvent(
      makePublicEvent('DeleteServerRequested', {serverId: this.serverId})
    );
  }

  removeServer() {
    this.dispatchEvent(
      makePublicEvent('ForgetServerRequested', {serverId: this.serverId})
    );
  }

  _isServerManaged(cloudId: string) {
    return !!cloudId;
  }

  _activeDataLimitForKey(accessKey?: DisplayAccessKey): number {
    if (!accessKey) {
      // We're in app startup
      return null;
    }

    if (exists(accessKey.dataLimitBytes)) {
      return accessKey.dataLimitBytes;
    }

    return this.isDefaultDataLimitEnabled ? this.defaultDataLimitBytes : null;
  }

  _computePaperProgressClass(accessKey: DisplayAccessKey) {
    return exists(this._activeDataLimitForKey(accessKey)) ? 'data-limits' : '';
  }

  _getRelevantTransferAmountForKey(accessKey: DisplayAccessKey) {
    if (!accessKey) {
      // We're in app startup
      return null;
    }
    const activeLimit = this._activeDataLimitForKey(accessKey);
    return exists(activeLimit) ? activeLimit : accessKey.transferredBytes;
  }

  _computeProgressWidthStyling(
    accessKey: DisplayAccessKey,
    baselineDataTransfer: number
  ) {
    const relativeTransfer = this._getRelevantTransferAmountForKey(accessKey);
    const width = Math.floor(
      (progressBarMaxWidthPx * relativeTransfer) / baselineDataTransfer
    );
    // It's important that there's no space in between width and "px" in order for Chrome to accept
    // the inline style string.
    return `width: ${width}px;`;
  }

  _getDataLimitsUsageString(
    accessKey: DisplayAccessKey,
    language: string,
    localize: Function
  ) {
    if (!accessKey) {
      // We're in app startup
      return '';
    }

    const activeDataLimit = this._activeDataLimitForKey(accessKey);
    const used = this._formatBytesTransferred(
      accessKey.transferredBytes,
      language,
      '0'
    );
    const total = this._formatDisplayDataLimit(
      activeDataLimit,
      language,
      localize
    );
    return localize('data-limits-usage', 'used', used, 'total', total);
  }
}

customElements.define(ServerView.is, ServerView);
