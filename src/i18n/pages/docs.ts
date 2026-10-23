import type { Dict } from '../index';

/**
 * Documentation chrome — every word around a page, in both languages.
 *
 * The page *bodies* are markdown files under `docs/en/**` and `docs/ko/**`; nothing of their prose lives here. What
 * lives here is the frame: the navigation label, the search box, the on-this-page rail, previous/next, the copy
 * button, the alert labels and the banner a Korean reader gets when the page they opened has not been translated yet.
 * Group names and page titles come from `docs/<lang>/_toctree.json`, which is why they are absent from this file.
 */
export const docs: Dict = {
  'docs.practice.title': { ko: 'AinCode에서 바로 실행', en: 'Run it in AinCode' },
  'docs.practice.body': { ko: '도구와 AinDrive Git이 준비된 작업 공간이 열리고, 이 문서의 첫 명령이 입력창에 들어가 있습니다. Enter를 누르면 실행됩니다. 각 코드 아래의 링크로 다른 단계도 같은 방식으로 실행할 수 있습니다.', en: 'Opens a workspace with the tools and AinDrive Git already set up, with this page\'s first command in the input box. Press Enter to run it. The link under each code block does the same for that step.' },
  'docs.practice.start': { ko: 'AinCode에서 실행하기', en: 'Run in AinCode' },
  'docs.practice.block': { ko: 'AinCode에서 이 코드 실행 →', en: 'Run this in AinCode →' },
  'docs.title': { ko: '문서', en: 'Documentation' },

  'docs.nav.label': { ko: '문서 목차', en: 'Documentation' },
  'docs.nav.close': { ko: '목차 닫기', en: 'Close the navigation' },

  'docs.search.placeholder': { ko: '문서 검색', en: 'Search the docs' },
  'docs.search.results': { ko: '검색 결과', en: 'Search results' },
  'docs.search.none': { ko: '"{q}"가 들어 있는 문서가 없습니다.', en: 'No page contains “{q}”.' },

  'docs.toc.label': { ko: '이 페이지 안에서', en: 'On this page' },

  'docs.pager.label': { ko: '이전 문서 · 다음 문서', en: 'Previous and next page' },
  'docs.pager.prev': { ko: '이전', en: 'Previous' },
  'docs.pager.next': { ko: '다음', en: 'Next' },

  'docs.copy': { ko: '복사', en: 'Copy' },
  'docs.copied': { ko: '복사했습니다', en: 'Copied' },
  // navigator.clipboard exists only in a secure context, so a node browsed at http://<lan-ip> can genuinely fail
  'docs.copy_failed': { ko: '복사하지 못했습니다', en: 'Could not copy' },

  'docs.anchor': { ko: '"{title}" 링크', en: 'Link to “{title}”' },

  'docs.alert.NOTE': { ko: '참고', en: 'Note' },
  'docs.alert.TIP': { ko: '도움말', en: 'Tip' },
  'docs.alert.IMPORTANT': { ko: '중요', en: 'Important' },
  'docs.alert.WARNING': { ko: '주의', en: 'Warning' },
  'docs.alert.CAUTION': { ko: '경고', en: 'Caution' },

  'docs.untranslated.title': { ko: '아직 한국어로 옮기지 못한 문서입니다', en: 'This page is not translated yet' },
  'docs.untranslated.body': { ko: '빈 화면을 보여 드리는 대신 영어 원문을 그대로 싣습니다. 목차와 화면의 다른 글자는 한국어 그대로입니다.', en: 'The English text is shown here rather than an empty page. The navigation and the rest of the interface stay in your language.' },
  'docs.untranslated.link': { ko: '영어 원문 페이지로 이동', en: 'Open the English page' },
  'docs.untranslated.short': { ko: '영어 원문', en: 'English text' },

  'docs.notfound.title': { ko: '그런 문서는 없습니다', en: 'No such page' },
  'docs.notfound.body': { ko: '{slug} 문서를 찾지 못했습니다. 왼쪽 목차에서 고르거나 검색해 보세요.', en: 'Nothing is published at {slug}. Pick a page from the navigation, or search for it.' },
  'docs.notfound.home': { ko: '문서 첫 페이지로', en: 'Go to the first page' },

  'docs.source': { ko: '저장소에서 이 페이지:', en: 'This page in the repository:' },
};
