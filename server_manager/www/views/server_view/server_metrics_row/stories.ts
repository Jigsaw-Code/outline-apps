import './index';

export default {
  title: 'Manager/Server View/Server Metrics Row',
  component: 'server-metrics-row',
  argTypes: {
    annotation: {control: 'text'},
    subcards: {control: 'object'},
    subtitle: {control: 'text'},
    title: {control: 'text'},
    titleIcon: {control: 'text'},
    tooltip: {control: 'text'},
    value: {control: 'text'},
    valueLabel: {control: 'text'},
  },
};

export const Example = {
  args: {
    title: 'Total Tunnel Time',
    value: '43.5',
    valueLabel: 'Total hours',
    annotation: '(last 30 days)',
    subtitle: 'ASNs with highest Tunnel Time',
    tooltip:
      'Lorem ipsum dolor sit amet,\nconsectetur adipiscing elit.\nDonec a diam lectus.',
    titleIcon: 'timer',
    subcards: [
      {
        highlight: '14.1hrs',
        title: 'Spectrum Online Systems Inc',
        subtitle: 'ASN3149',
        icon: '🇺🇸',
      },
      {
        highlight: '14.1hrs',
        title: 'Spectrum Online Systems Inc',
        subtitle: 'ASN3149',
        icon: '🇺🇸',
      },
      {
        highlight: '14.1hrs',
        title: 'Spectrum Online Systems Inc',
        subtitle: 'ASN3149',
        icon: '🇺🇸',
      },
      {
        highlight: '14.1hrs',
        title: 'Spectrum Online Systems Inc',
        subtitle: 'ASN3149',
        icon: '🇺🇸',
      },
    ],
  },
};
