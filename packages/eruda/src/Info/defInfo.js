import detectBrowser from 'licia/detectBrowser'
import detectOs from 'licia/detectOs'
import escape from 'licia/escape'
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
  ]
}
