'use client';
/** Client rendering failure must preserve the durable run/unsent queue and offer a safe way back. */
export default function LessonError({reset}:{reset:()=>void}) {
  return <main className="lesson-player"><h1>Не вдалося відобразити урок</h1>
    <p role="alert">Спробуйте відновити урок. Підтверджені відповіді збережені на сервері.</p>
    <p>Код: LESSON_DISPLAY_UNAVAILABLE</p>
    <button onClick={reset}>Відновити урок</button><a href="/">Повернутися на головну</a>
  </main>;
}
