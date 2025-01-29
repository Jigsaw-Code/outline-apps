import {html} from 'lit';

import './index';

const meta = {
  title: 'Server View/Server Stat Row/Server Stat Subcard',
  component: 'server-stat-subcard',
  argTypes: {
    highlightText: {control: 'text'},
    titleText: {control: 'text'},
    subtitleText: {control: 'text'},
    icon: {control: 'text'},
  },
  parameters: {
    layout: 'padded', // Add padding around the component in Storybook
  },
};

export default meta;

// Default story
export const Default = {
  args: {
    highlightText: '14.1hrs',
    titleText: 'Spectrum Online Systems Inc',
    subtitleText: 'ASN3149',
    icon: '🇺🇸',
  },
};

// No Highlight
export const NoHighlight = {
  args: {
    titleText: 'Spectrum Online Systems Inc',
    subtitleText: 'ASN3149',
    icon: '🇺🇸',
  },
};

// No Icon
export const NoIcon = {
  args: {
    highlightText: '14.1hrs',
    titleText: 'Spectrum Online Systems Inc',
    subtitleText: 'ASN3149',
  },
};

// Only Title
export const OnlyTitle = {
  args: {
    titleText: 'Only Title Example',
  },
};

// Long Title and Subtitle
export const LongText = {
  args: {
    highlightText: '24.7hrs',
    titleText:
      'Very Long Company Name Example That Might Wrap to Multiple Lines',
    subtitleText:
      'ASN9876543210 - This is also a very long subtitle that should wrap.',
    icon: '🇬🇧',
  },
};

// Different Icon
export const DifferentIcon = {
  args: {
    highlightText: '5.3hrs',
    titleText: 'Another Company',
    subtitleText: 'ASN5678',
    icon: '🇪🇺', // European Union flag
  },
};

// Custom Styling Example (using part)
export const CustomStyling = {
  args: {
    highlightText: 'Important',
    titleText: 'Custom Styled Card',
    subtitleText: 'Using CSS Parts',
    icon: '✨',
  },
  render: args => html`
    <style>
      info-card::part(highlight) {
        background-color: #ffeb3b; /* Yellow */
        color: black;
      }
      info-card::part(title) {
        font-size: 1.25rem;
        color: #03a9f4; /* Light Blue */
      }
      info-card::part(subtitle) {
        font-style: italic;
      }
    </style>
    <info-card
      highlight-text="${args.highlightText}"
      title-text="${args.titleText}"
      subtitle-text="${args.subtitleText}"
      icon="${args.icon}"
    ></info-card>
  `,
};

// Wrapper Example
export const WithWrapper = {
  render: () => html`
    <div style="width: 200px; border: 1px solid black; padding: 10px;">
      <info-card
        highlight-text="14.1hrs"
        title-text="Spectrum Online Systems Inc"
        subtitle-text="ASN3149"
        icon="🇺🇸"
      >
      </info-card>
    </div>
    <div
      style="width: 500px; border: 1px solid black; padding: 10px; margin-top: 20px"
    >
      <info-card
        highlight-text="14.1hrs"
        title-text="Spectrum Online Systems Inc"
        subtitle-text="ASN3149"
        icon="🇺🇸"
      >
      </info-card>
    </div>
  `,
};
