/**
 * Триггер обновления сайта https://aleksey-lyapin.github.io/sales-funnel-ekb/
 *
 * Ставится в книгу «Воронка продаж_Екб»: Расширения → Apps Script.
 * При изменении книги скрипт сразу просит GitHub пересобрать сайт; правки,
 * сделанные чаще раза в 20 секунд, отправляются одной пачкой минутным таймером.
 * Если нужные листы не менялись, сборка ничего не публикует.
 *
 * Настройка один раз:
 * 1. Вставьте этот код в Code.gs и сохраните.
 * 2. Настройки проекта (шестерёнка) → Свойства скрипта → добавить свойство
 *    GITHUB_TOKEN = токен GitHub с доступом только к репозиторию sales-funnel-ekb
 *    (Contents: Read and write).
 * 3. Выберите функцию install и нажмите «Выполнить», разрешите доступ.
 */
const REPO = 'Aleksey-Lyapin/sales-funnel-ekb';
const MIN_GAP_MS = 20 * 1000;

function install() {
  ScriptApp.getProjectTriggers().forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('onSheetChange').forSpreadsheet(SpreadsheetApp.getActive()).onChange().create();
  ScriptApp.newTrigger('flush').timeBased().everyMinutes(1).create();
  PropertiesService.getScriptProperties().setProperty('DIRTY', '1');
  flush();
}

function onSheetChange() {
  PropertiesService.getScriptProperties().setProperty('DIRTY', '1');
  const last = Number(PropertiesService.getScriptProperties().getProperty('SENT_AT') || 0);
  if (Date.now() - last >= MIN_GAP_MS) flush();
}

function flush() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return; // another run is sending; it or the next minute will pick this up
  try {
    const props = PropertiesService.getScriptProperties();
    if (!props.getProperty('DIRTY')) return;
    const token = props.getProperty('GITHUB_TOKEN');
    if (!token) throw new Error('Не задано свойство скрипта GITHUB_TOKEN');
    props.deleteProperty('DIRTY');
    props.setProperty('SENT_AT', String(Date.now()));
    const res = UrlFetchApp.fetch('https://api.github.com/repos/' + REPO + '/dispatches', {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' },
      payload: JSON.stringify({ event_type: 'sheet-changed' }),
      muteHttpExceptions: true,
    });
    if (res.getResponseCode() !== 204) {
      props.setProperty('DIRTY', '1'); // try again next minute
      throw new Error('GitHub ответил ' + res.getResponseCode() + ': ' + res.getContentText());
    }
  } finally {
    lock.releaseLock();
  }
}
