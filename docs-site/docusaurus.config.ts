import { themes as prismThemes } from 'prism-react-renderer';
import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'Content Credits SDK',
  tagline: 'Drop-in paywall and comments for any website',
  favicon: 'img/favicon.ico',

  url: 'https://docs.contentcredits.com',
  baseUrl: '/',

  onBrokenLinks: 'warn',
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          routeBasePath: '/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/favicon.ico',
    colorMode: {
      defaultMode: 'light',
      disableSwitch: false,
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: '',
      logo: {
        alt: 'Content Credits',
        src: 'img/logo.svg',
        style: { height: '28px', width: 'auto' },
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: 'Documentation',
        },
        {
          href: 'https://app.contentcredits.com',
          label: 'Dashboard',
          position: 'right',
        },
        {
          href: 'https://contentcredits.com',
          label: 'Website',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            { label: 'Introduction', to: '/' },
            { label: 'Quick Start', to: '/getting-started/quick-start' },
            { label: 'API Reference', to: '/api-reference/contentcredits-class' },
          ],
        },
        {
          title: 'Integration',
          items: [
            { label: 'Plain HTML', to: '/integration-guides/html' },
            { label: 'WordPress', to: '/integration-guides/wordpress' },
            { label: 'React / Next.js', to: '/integration-guides/react' },
          ],
        },
        {
          title: 'Content Credits',
          items: [
            { label: 'Dashboard', href: 'https://app.contentcredits.com' },
            { label: 'Website', href: 'https://contentcredits.com' },
            { label: 'Support', href: 'mailto:support@contentcredits.com' },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Content Credits. All rights reserved.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'json', 'php'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
