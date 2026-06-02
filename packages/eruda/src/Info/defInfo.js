import detectBrowser from 'licia/detectBrowser'
import detectOs from 'licia/detectOs'
import escape from 'licia/escape'
import map from 'licia/map'
import i18n from '../lib/i18n'

export default function getDefInfo() {
  const browser = detectBrowser()
  return [
    {
      name: i18n.t('info.location'),
      val() {
        return escape(location.href)
      },
    },
    {
      name: i18n.t('info.userAgent'),
      val: navigator.userAgent,
    },
    {
      name: i18n.t('info.device'),
      val: [
        '<table><tbody>',
        `<tr><td class="eruda-device-key">${i18n.t('info.screen')}</td><td>${screen.width} * ${screen.height}</td></tr>`,
        `<tr><td>${i18n.t('info.viewport')}</td><td>${window.innerWidth} * ${window.innerHeight}</td></tr>`,
        `<tr><td>${i18n.t('info.pixelRatio')}</td><td>${window.devicePixelRatio}</td></tr>`,
        '</tbody></table>',
      ].join(''),
    },
    {
      name: i18n.t('info.system'),
      val: [
        '<table><tbody>',
        `<tr><td class="eruda-system-key">${i18n.t('info.os')}</td><td>${detectOs()}</td></tr>`,
        `<tr><td>${i18n.t('info.browser')}</td><td>${
          browser.name + ' ' + browser.version
        }</td></tr>`,
        '</tbody></table>',
      ].join(''),
    },
    {
      name: i18n.t('info.sponsor'),
      val() {
        return (
          '<table><tbody>' +
          map(
            [
              {
                name: i18n.t('info.openCollective'),
                link: 'https://opencollective.com/eruda',
              },
              {
                name: i18n.t('info.koFi'),
                link: 'https://ko-fi.com/surunzi',
              },
              {
                name: i18n.t('info.wechatPay'),
                link: 'https://surunzi.com/wechatpay.html',
              },
            ],
            (item) => {
              return `<tr><td>${
                item.name
              }</td><td><a rel="noreferrer noopener" href="${
                item.link
              }" target="_blank">${item.link.replace(
                'https://',
                ''
              )}</a></td></tr>`
            }
          ).join(' ') +
          '</tbody></table>'
        )
      },
    },
    {
      name: i18n.t('info.about'),
      val:
        '<a href="https://eruda.liriliri.io" target="_blank">Eruda v' +
        VERSION +
        '</a>',
    },
  ]
}
