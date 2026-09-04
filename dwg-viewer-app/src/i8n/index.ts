import { AcApI18n } from '@mlightcad/cad-simple-viewer'

import en from './en'
import zh from './zh'
import { koUiMessages } from './ko-ui'

export const initializeLocale = () => {
  AcApI18n.mergeLocaleMessage('en', en)
  AcApI18n.mergeLocaleMessage('zh', zh)
}

/**
 * cad-simple-ui-plugin 이 'en' 버킷에 등록한 툴바/레이어/검토 문구를 한국어로 덮어쓴다.
 * 반드시 `registerSimpleUiPlugin`(내부에서 registerSimpleUiI18n 실행) **이후**에 호출할 것.
 * 마지막에 로케일을 다시 지정해 플러그인의 localeChanged 리스너로 툴바를 새로고침한다.
 */
export const applyKoreanUiLabels = () => {
  AcApI18n.mergeLocaleMessage('en', koUiMessages)
  // 같은 값이라도 setCurrentLocale 은 항상 localeChanged 를 발생시켜 툴바가 refresh 된다.
  AcApI18n.setCurrentLocale(AcApI18n.currentLocale)
}
