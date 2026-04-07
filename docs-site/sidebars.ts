import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docsSidebar: [
    {
      type: 'doc',
      id: 'intro',
      label: 'Introduction',
    },
    {
      type: 'category',
      label: 'Getting Started',
      collapsed: false,
      items: [
        'getting-started/installation',
        'getting-started/quick-start',
        'getting-started/configuration',
      ],
    },
    {
      type: 'category',
      label: 'Features',
      collapsed: false,
      items: [
        'features/paywall',
        'features/comments',
        'features/events',
        'features/theming',
      ],
    },
    {
      type: 'category',
      label: 'Integration Guides',
      items: [
        'integration-guides/html',
        'integration-guides/wordpress',
        'integration-guides/react',
        'integration-guides/headless',
      ],
    },
    {
      type: 'category',
      label: 'API Reference',
      items: [
        'api-reference/contentcredits-class',
        'api-reference/configuration',
        'api-reference/events',
        'api-reference/state',
      ],
    },
    {
      type: 'category',
      label: 'Advanced',
      items: [
        'advanced/security',
        'advanced/mobile',
      ],
    },
  ],
};

export default sidebars;
