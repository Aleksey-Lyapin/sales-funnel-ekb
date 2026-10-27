/**
 * Триггер обновления сайта https://aleksey-lyapin.github.io/sales-funnel-ekb/
 *
 * Ставится в книгу «Воронка продаж_Екб»: Расширения → Apps Script.
 * Любое изменение книги помечается, и раз в минуту, если были изменения,
 * скрипт просит GitHub пересобрать сайт. Если нужные листы не менялись,
 * сборка ничего не публикует.
 *
 * Настройка один раз:
 * 1. Вставьте этот код в Code.gs и сохраните.
 * 2. Настройки проекта (шестерёнка) → Свойства скрипта → добавить свойство
 *    GITHUB_TOKEN = токен GitHub с доступом только к репозиторию sales-funnel-ekb
 *    (Contents: Read and write).
 * 3. Выберите функцию install и нажмите «Выполнить», разрешите доступ.
 */
const REPO = 'Aleksey-Lyapin/sales-funnel-ekb';

function install() {
  ScriptApp.getProjectTriggers().forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('markChanged').forSpreadsheet(SpreadsheetApp.getActive()).onChange().create();
  ScriptApp.newTrigger('flush').timeBased().everyMinutes(1).create();
  markChanged();
  flush();
}

function markChanged() {
  PropertiesService.getScriptProperties().setProperty('DIRTY', String(Date.now()));
}

function flush() {
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('DIRTY')) return;
  props.deleteProperty('DIRTY');
  const token = props.getProperty('GITHUB_TOKEN');
  if (!token) throw new Error('Не задано свойство скрипта GITHUB_TOKEN');
  const res = UrlFetchApp.fetch('https://api.github.com/repos/' + REPO + '/dispatches', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' },
    payload: JSON.stringify({ event_type: 'sheet-changed' }),
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 204) {
    markChanged(); // try again next minute
    throw new Error('GitHub ответил ' + res.getResponseCode() + ': ' + res.getContentText());
  }
}
