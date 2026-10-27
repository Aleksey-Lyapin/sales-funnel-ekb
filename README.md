# Воронка продаж ЕКБ

Сайт: https://aleksey-lyapin.github.io/sales-funnel-ekb/

Дашборд по книге Google «Воронка продаж_Екб» (листы ДНК, ДМД, Алиса — ДДУ; ПИФ). Данные в репозитории не хранятся: их забирает сборка и публикует вместе со страницей на GitHub Pages.

## Как обновляется

- `build.py` читает диапазоны листов через сервисный аккаунт (секрет `GOOGLE_SA_KEY`), вставляет их в `wrapper.html` вместе со страницей `page.html` и кладёт результат в `site/`.
- Workflow `.github/workflows/build.yml` запускается:
  - сразу после правки таблицы — скрипт `apps-script/Code.gs` в самой книге раз в минуту отправляет `repository_dispatch` (`sheet-changed`), если книгу меняли;
  - каждые 5 минут по расписанию — запасной путь;
  - при пуше в `main` и вручную (Actions → Build and deploy → Run workflow).
- Если данные и страница не изменились (сравнивается `data-hash.txt` на сайте), публикация пропускается.

## Файлы

- `page.html` — сама страница (та же, что в дашборде на claude.ai); `wrapper.html` — оболочка с заменой рантайма claude.ai (`window.dash`), шрифтами и d3.
- `build.py` — сборка. Локально: `GOOGLE_SA_FILE=путь/к/ключу.json python build.py`.
- `apps-script/Code.gs` — триггер для книги, инструкция в шапке файла.
