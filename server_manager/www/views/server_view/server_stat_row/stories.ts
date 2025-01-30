import './index';

export default {
  title: 'Components/Server View/Server Stat Row',
  component: 'server-stat-row',
  argTypes: {
    title: {control: 'text'},
    totalValue: {control: 'text'},
    totalValueLabel: {control: 'text'},
    subTitle: {control: 'text'},
    tooltipText: {control: 'text'},
    titleIcon: {control: 'text'},
    subcardsData: {control: 'object'},
  },
};

export const Example = {
  args: {
    title: 'Total Tunnel Time (last 30 days)',
    totalValue: '43.5',
    totalValueLabel: 'Total hours',
    subTitle: 'ASNs with highest Tunnel Time (last 30 days)',
    tooltipText:
      'Lorem ipsum dolor sit amet,\nconsectetur adipiscing elit.\nDonec a diam lectus.',
    titleIcon: 'swap_horiz',
    subcardsData: [
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
