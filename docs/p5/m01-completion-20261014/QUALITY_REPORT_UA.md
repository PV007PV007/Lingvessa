# Автоматична перевірка якості M01 — 14 жовтня 2026

Усі **420 / 420** фінальних WAV присутні. 216 попередніх файлів збережені без змін; 204 чеські файли додані. Перевірено контрольні суми, повний PCM, тривалість, межі реплік, відсутність цифрового кліпінгу та повільні версії. Усі 420 файлів мають автоматичну транскрипцію.

Мала ASR-модель позначила **243 файли**, з них **134 нових**. Прапорець означає розбіжність текстів; він не встановлює, чи помилився синтезатор або розпізнавач. Назви, числа й короткі слова потребують особливо обережної інтерпретації. Людських оцінок не створено.

## Повторна діагностика всіх повних чеських діалогів

Відібрано всі десять файлів до запуску більшої моделі. Авторський текст не передавався як підказка жодному розпізнавачу. Обидві моделі належать до сімейства Whisper. Отримано 67 словесних розбіжностей у малої моделі та 26 у більшої на 160 словах; це діагностика, а не оцінка носія мови.

| Запис | Слів | Мала ASR: розбіжностей | Більша ASR: розбіжностей |
| --- | ---: | ---: | ---: |
| AUD_CZE_M01_DIALOGUES_L01_CONTEXT | 4 | 2 | 2 |
| AUD_CZE_M01_DIALOGUES_L01_CONTEXT_SLOW | 4 | 2 | 2 |
| AUD_CZE_M01_DIALOGUES_L01_REPAIR | 15 | 7 | 4 |
| AUD_CZE_M01_DIALOGUES_L01_REPAIR_SLOW | 15 | 8 | 6 |
| AUD_CZE_M01_DIALOGUES_L04_FORMAL | 19 | 7 | 3 |
| AUD_CZE_M01_DIALOGUES_L04_FORMAL_SLOW | 19 | 7 | 3 |
| AUD_CZE_M01_DIALOGUES_L04_INFORMAL | 23 | 6 | 1 |
| AUD_CZE_M01_DIALOGUES_L04_INFORMAL_SLOW | 23 | 6 | 0 |
| AUD_CZE_M01_DIALOGUES_R01_FIRST_CONTACT | 19 | 12 | 2 |
| AUD_CZE_M01_DIALOGUES_R01_FIRST_CONTACT_SLOW | 19 | 10 | 3 |

## Що прослухати першочергово

- «Dobrý den»: повторюване «Dobý den» в обох автоматичних перевірках; перевірити звук r.
- «Jmenuji se Klára»: варіанти «Jmenuj se Klara»; перевірити закінчення дієслова та довготу голосних.
- «Děkuji»: варіант «Díkuj»; перевірити голосні й закінчення.
- Порівняти нормальний і повільний темп; уповільнення не виправляє помилок вихідної вимови.

## Обидва автоматичні тексти

### AUD_CZE_M01_DIALOGUES_L01_CONTEXT

Авторський текст: Dobrý den. / Dobrý den.

Мала ASR: Dobí den. Dobí den.

Більша ASR: Dobý den. Dobý den.

SHA-256 аудіо: `1e4e3149ffa6f038fe34a12238307d4b14bc695cebf27f7e72f23b400f72299f`.

### AUD_CZE_M01_DIALOGUES_L01_CONTEXT_SLOW

Авторський текст: Dobrý den. / Dobrý den.

Мала ASR: Dobí den. Dobí den.

Більша ASR: Dobý den. Dobý den.

SHA-256 аудіо: `297942524997526ad284d5f5fe8c2c3d9c992813d5a3e4bb32e0bdc8949b5c2c`.

### AUD_CZE_M01_DIALOGUES_L01_REPAIR

Авторський текст: Dobrý den. Jmenuji se Klára. / Promiňte. Nerozumím. Můžete to zopakovat, prosím? / Jmenuji se Klára. / Děkuji.

Мала ASR: Dobí den, menuj se kvára. Promínte, nerozumím, můžete to zopakovat, prosím. Menuj se kvára. Tykuj.

Більша ASR: Dobý den, jmenuji se Klara. Promiňte, nerozumím, můžete to zopakovat, prosím. Jmenuji se Klara. Díkuj.

SHA-256 аудіо: `8608b4edc109dca8dc48ce16cf563457ea0b6a7db39b21c7b1af903c344a2120`.

### AUD_CZE_M01_DIALOGUES_L01_REPAIR_SLOW

Авторський текст: Dobrý den. Jmenuji se Klára. / Promiňte. Nerozumím. Můžete to zopakovat, prosím? / Jmenuji se Klára. / Děkuji.

Мала ASR: Do býden, menuj se kvára. Promínte, nerozumím, můžete to zopakovat, prosím. Menuj se kvára. Tykuj.

Більша ASR: Dobý den, jmenuj se Klara. Promiňte, nerozumím, můžete to zopakovat, prosím. Jmenuj se Klara. Díkuj.

SHA-256 аудіо: `cb7f6613767257a59c6847222741ad5853eba7ed4d943dd645f9d6b8a923029d`.

### AUD_CZE_M01_DIALOGUES_L04_FORMAL

Авторський текст: Dobrý den. Jak se jmenujete? / Dobrý den. Jmenuji se Oksana. / Odkud jste? / Jsem z Ukrajiny. / Těší mě. / Mě také.

Мала ASR: Dobí den, jak se menujete, ne? Dobí den, menuj se Oksana. Odkud jste. Jsem z Ukrainy. Kěši mě. Mě také.

Більша ASR: Dobý den, jak se jmenujete, ne? Dobý den, jmenuji se Oksana. Odkud jste? Jsem z Ukrajiny. Těší mě. Mě také.

SHA-256 аудіо: `d90b2c80bfac155171734ac719dc14a4a7b7c2901842ad6386a9160d411fc379`.

### AUD_CZE_M01_DIALOGUES_L04_FORMAL_SLOW

Авторський текст: Dobrý den. Jak se jmenujete? / Dobrý den. Jmenuji se Oksana. / Odkud jste? / Jsem z Ukrajiny. / Těší mě. / Mě také.

Мала ASR: Dobí den, jak se menujete? Ne. Dobí den, menuj se Oksana. Odkud jste. Jsem z Ukrainy. Těším mě. Mě také.

Більша ASR: Dobý den, jak se jmenujete? Dobý den, jmenuji se Oksana. Odkud jste? Jsem z Ukrainy. Těší mě. Mě také.

SHA-256 аудіо: `1fe4e4f28f0e738421e666c9e7961c32c67def2f80f78935517812b85201ed1c`.

### AUD_CZE_M01_DIALOGUES_L04_INFORMAL

Авторський текст: Ahoj. Jak se jmenuješ? / Ahoj. Jmenuji se Oksana. / Odkud jsi? / Jsem z Ukrajiny. Odkud jsi? / Jsem z Česka. Těší mě. / Taky mě těší.

Мала ASR: Ahoj, jak se jmenuješ? Ahoj, jmenuj se Oksana. Odkutí si. Jsem z Ukrainy, odkutí si. Jsem z Česka, těší mě. Taky mě těší.

Більша ASR: Ahoj, jak se jmenuješ? Ahoj, jmenuji se Oksana. Odkud ty jsi? Jsem z Ukrajiny, odkud jsi? Jsem z Česka, těší mě. Taky mě těší.

SHA-256 аудіо: `e07c448d60b1e8bdbd5c33ad453f9e76840220d42ffd682f5410e6fde1846358`.

### AUD_CZE_M01_DIALOGUES_L04_INFORMAL_SLOW

Авторський текст: Ahoj. Jak se jmenuješ? / Ahoj. Jmenuji se Oksana. / Odkud jsi? / Jsem z Ukrajiny. Odkud jsi? / Jsem z Česka. Těší mě. / Taky mě těší.

Мала ASR: Ahoj, jak se jmenuješ? Ahoj, jmenuj se Oksana. Odkutí si. Jsem z Ukrainy, odkutí si. Jsem z Česka, těší mě. Taky mě těší.

Більша ASR: Ahoj, jak se jmenuješ? Ahoj, jmenuji se Oksana. Odkud jsi? Jsem z Ukrajiny, odkud jsi? Jsem z Česka, těší mě. Taky mě těší.

SHA-256 аудіо: `41c99e2a6b01e5e2cd0bf750f0e8cb5069d5404b23bc52d5a9649f1cc40c1300`.

### AUD_CZE_M01_DIALOGUES_R01_FIRST_CONTACT

Авторський текст: Dobrý den. Vy jste Oksana? / Dobrý den. Ano. / Odkud jste? / Jsem z Ukrajiny. / Těší mě. / Mě také. Na shledanou.

Мала ASR: Doblý den, vojste Oksana. Doblý den, ano. Odkudste. Jsem z Ukrainy. Kěží mě. Nětaké, nás chledanou.

Більша ASR: Dobrý den, voj jste Oksana? Dobrý den, ano. Odkud jste? Jsem z Ukrainy. Těší mě. Mě také, na shledanou.

SHA-256 аудіо: `afc44ee2ce424435a007ecce5f8ea112d75676217b6b270ce9b400f5efbc09c4`.

### AUD_CZE_M01_DIALOGUES_R01_FIRST_CONTACT_SLOW

Авторський текст: Dobrý den. Vy jste Oksana? / Dobrý den. Ano. / Odkud jste? / Jsem z Ukrajiny. / Těší mě. / Mě také. Na shledanou.

Мала ASR: Doblý den, vojste Oksana. Doblý den, ano. Odkud jste. Jsem z Ukrainy. Kěží mě. Nětaké, nás chledanou.

Більша ASR: Dobrý den. Vy jste Oksana? Dobrý den. Ano. Odkud jste? Jsem z Ukrainy. Těší mě. Mě také. Naschledanou.

SHA-256 аудіо: `8412bc0ed89fab2cf62d20d0434f5c8ec06c7466c293ca5300eb4ed38703b840`.

Форма прослуховування містить усі 420 записів, авторські тексти, підказки ASR та прив’язані до аудіо нотатки. Остаточна мовна оцінка, затвердження голосів і прав, публікація та завершення P5 залишаються відкритими.
