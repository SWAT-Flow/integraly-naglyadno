import type { LearningModule, LearningPreset, LearningSection, PracticeItem } from "./types";

function paragraph(text: string): LearningSection {
  return { type: "paragraph", text };
}

function formula(tex: string, title?: string, note?: string): LearningSection {
  return { type: "formula", tex, title, note };
}

function list(items: string[], title?: string): LearningSection {
  return { type: "list", title, items };
}

function callout(
  text: string,
  title?: string,
  tone: "slate" | "blue" | "emerald" | "rose" | "amber" | "violet" = "blue",
): LearningSection {
  return { type: "callout", title, text, tone };
}

function practice(items: [PracticeItem, PracticeItem, PracticeItem], title = "Примеры по теме"): LearningSection {
  return { type: "practice", title, items };
}

function preset(
  id: string,
  _title: string,
  description: string,
  data: Omit<LearningPreset, "id" | "title" | "description">,
): LearningPreset {
  return { id, title: "Открыть пример в калькуляторе", description, ...data };
}

export const LEARNING_MODULES: LearningModule[] = [
  {
    id: "what-is-integral",
    title: "Что такое определённый интеграл",
    summary: "Определённый интеграл связывает функцию на отрезке с одним итоговым числом и описывает накопленный результат на всём промежутке.",
    presets: [
      preset(
        "intro-under",
        "Открыть пример в калькуляторе",
        "Посмотреть базовый интеграл как площадь под графиком {{tex:y=x}} на отрезке {{tex:[0,2]}}.",
        {
          expressions: [{ text: "x" }],
          tool: { mode: "under", a: 0, b: 2, exprA: null },
          view: { xMin: -0.5, xMax: 2.5, yMin: -0.5, yMax: 2.5 },
        },
      ),
      preset(
        "intro-constant",
        "Открыть пример в калькуляторе",
        "Постоянная функция {{tex:y=2}} на отрезке {{tex:[1,4]}} показывает площадь прямоугольника.",
        {
          expressions: [{ text: "2" }],
          tool: { mode: "under", a: 1, b: 4, exprA: null },
          view: { xMin: 0.5, xMax: 4.5, yMin: -0.5, yMax: 3.2 },
        },
      ),
      preset(
        "intro-linear",
        "Открыть пример в калькуляторе",
        "Линейная функция {{tex:y=2x+1}} на {{tex:[0,3]}} для прямого вычисления определённого интеграла.",
        {
          expressions: [{ text: "2x + 1" }],
          tool: { mode: "under", a: 0, b: 3, exprA: null },
          view: { xMin: -0.4, xMax: 3.4, yMin: -0.5, yMax: 7.4 },
        },
      ),
    ],
    sections: [
      paragraph(
        "Запись {{tex:\\int_a^b f(x)\\,dx}} обозначает не значение функции в одной точке, а общий результат действия функции на всём промежутке от {{tex:a}} до {{tex:b}}.",
      ),
      paragraph(
        "Числа {{tex:a}} и {{tex:b}} называют пределами интегрирования, {{tex:f(x)}} — подынтегральной функцией, а символ {{tex:dx}} показывает, по какой переменной складываются малые вклады.",
      ),
      formula("\\int_a^b f(x)\\,dx", "Базовая запись"),
      callout(
        "Определённый интеграл всегда даёт одно конкретное число. Если меняется функция или границы интегрирования, меняется и результат.",
        "Главная идея",
        "emerald",
      ),
      practice([
        {
          id: "m1-basic",
          level: "Базовый",
          prompt: "Вычислите {{tex:\\int_0^2 x\\,dx}}.",
          answer: "Ответ: {{tex:2}}.",
          solution:
            "Первообразная для {{tex:x}} равна {{tex:\\frac{x^2}{2}}}. Тогда {{tex:\\int_0^2 x\\,dx = \\left.\\frac{x^2}{2}\\right|_0^2 = 2}}.",
          presetId: "intro-under",
        },
        {
          id: "m1-medium",
          level: "Средний",
          prompt: "Вычислите {{tex:\\int_1^4 2\\,dx}} и объясните ответ геометрически.",
          answer: "Ответ: {{tex:6}}.",
          solution:
            "Интеграл от постоянной равен площади прямоугольника: высота {{tex:2}}, основание {{tex:4-1=3}}. Поэтому {{tex:\\int_1^4 2\\,dx = 2\\cdot 3 = 6}}.",
          presetId: "intro-constant",
        },
        {
          id: "m1-hard",
          level: "Сложный",
          prompt: "Вычислите {{tex:\\int_0^3 (2x+1)\\,dx}}.",
          answer: "Ответ: {{tex:12}}.",
          solution:
            "Первообразная: {{tex:x^2+x}}. Тогда {{tex:\\int_0^3 (2x+1)\\,dx = \\left.(x^2+x)\\right|_0^3 = 9+3 = 12}}.",
          presetId: "intro-linear",
        },
      ]),
    ],
  },
  {
    id: "geometric-meaning",
    title: "Геометрический смысл интеграла",
    summary: "Если график расположен над осью Ox, определённый интеграл совпадает с площадью криволинейной трапеции; при смене знака нужно учитывать ориентированную площадь.",
    presets: [
      preset(
        "geometry-area",
        "Открыть пример в калькуляторе",
        "Площадь под графиком {{tex:y=\\sqrt{x}}} на отрезке {{tex:[0,4]}}.",
        {
          expressions: [{ text: "sqrt(x)" }],
          tool: { mode: "under", a: 0, b: 4, exprA: null },
          view: { xMin: -0.5, xMax: 4.5, yMin: -0.5, yMax: 2.8 },
        },
      ),
      preset(
        "geometry-signed",
        "Открыть пример в калькуляторе",
        "График {{tex:y=x}} на симметричном промежутке {{tex:[-1,1]}} показывает разницу между ориентированной и геометрической площадью.",
        {
          expressions: [{ text: "x" }],
          tool: { mode: "under", a: -1, b: 1, exprA: null },
          view: { xMin: -1.3, xMax: 1.3, yMin: -1.3, yMax: 1.3 },
        },
      ),
      preset(
        "geometry-triangle",
        "Открыть пример в калькуляторе",
        "Функция {{tex:y=1-x}} на {{tex:[0,1]}} даёт треугольную область под графиком.",
        {
          expressions: [{ text: "1 - x" }],
          tool: { mode: "under", a: 0, b: 1, exprA: null },
          view: { xMin: -0.2, xMax: 1.2, yMin: -0.2, yMax: 1.2 },
        },
      ),
    ],
    sections: [
      paragraph(
        "Если {{tex:f(x) \\ge 0}} на всём промежутке {{tex:[a,b]}}, то интеграл {{tex:\\int_a^b f(x)\\,dx}} численно равен площади фигуры под графиком функции.",
      ),
      formula("S = \\int_a^b f(x)\\,dx \\quad \\text{при} \\quad f(x)\\ge 0", "Площадь под графиком"),
      paragraph(
        "Если функция уходит ниже оси {{tex:Ox}}, интеграл начинает учитывать знак: участки выше оси дают положительный вклад, участки ниже — отрицательный.",
      ),
      callout(
        "Геометрическая площадь всегда неотрицательна, а определённый интеграл может оказаться равным нулю или даже отрицательным.",
        "Важно не путать",
        "amber",
      ),
      practice([
        {
          id: "m2-basic",
          level: "Базовый",
          prompt: "Найдите площадь под графиком {{tex:y=\\sqrt{x}}} на {{tex:[0,4]}}.",
          answer: "Ответ: {{tex:\\frac{16}{3}}}.",
          solution:
            "Интеграл равен {{tex:\\int_0^4 \\sqrt{x}\\,dx = \\left.\\frac{2}{3}x^{3/2}\\right|_0^4 = \\frac{2}{3}\\cdot 8 = \\frac{16}{3}}}.",
          presetId: "geometry-area",
        },
        {
          id: "m2-medium",
          level: "Средний",
          prompt: "Сравните {{tex:\\int_{-1}^{1} x\\,dx}} и геометрическую площадь под графиком {{tex:y=x}} на {{tex:[-1,1]}}.",
          answer: "Ответ: интеграл равен {{tex:0}}, а площадь равна {{tex:1}}.",
          solution:
            "На {{tex:[-1,0]}} вклад отрицательный, на {{tex:[0,1]}} — положительный, и они взаимно уничтожаются. Но геометрически это два равных треугольника площадью по {{tex:\\frac12}}.",
          presetId: "geometry-signed",
        },
        {
          id: "m2-hard",
          level: "Сложный",
          prompt: "Найдите площадь под графиком {{tex:y=1-x}} на {{tex:[0,1]}}.",
          answer: "Ответ: {{tex:\\frac12}}.",
          solution:
            "Это либо площадь прямоугольного треугольника, либо интеграл {{tex:\\int_0^1 (1-x)\\,dx = \\left.(x-\\frac{x^2}{2})\\right|_0^1 = \\frac12}}.",
          presetId: "geometry-triangle",
        },
      ]),
    ],
  },
  {
    id: "riemann-sums",
    title: "Суммы Римана и предел",
    summary: "Определённый интеграл рождается как предел сумм площадей маленьких прямоугольников, которые приближают фигуру под графиком.",
    presets: [
      preset(
        "riemann-left",
        "Открыть пример в калькуляторе",
        "Левая сумма Римана для {{tex:f(x)=x}} на {{tex:[0,2]}} при {{tex:n=4}}.",
        {
          expressions: [{ text: "x" }],
          tool: { mode: "riemann", a: 0, b: 2, n: 4, sample: "left", exprA: null },
          view: { xMin: -0.3, xMax: 2.3, yMin: -0.3, yMax: 2.5 },
        },
      ),
      preset(
        "riemann-mid",
        "Открыть пример со средней точкой",
        "Сумма Римана по серединам для {{tex:f(x)=x^2}} на {{tex:[0,2]}}.",
        {
          expressions: [{ text: "x^2" }],
          tool: { mode: "riemann", a: 0, b: 2, n: 4, sample: "mid", exprA: null },
          view: { xMin: -0.3, xMax: 2.3, yMin: -0.3, yMax: 4.5 },
        },
      ),
      preset(
        "riemann-right",
        "Открыть пример в калькуляторе",
        "Правая сумма Римана для {{tex:f(x)=2x+1}} на {{tex:[0,3]}} при {{tex:n=6}}.",
        {
          expressions: [{ text: "2x + 1" }],
          tool: { mode: "riemann", a: 0, b: 3, n: 6, sample: "right", exprA: null },
          view: { xMin: -0.4, xMax: 3.4, yMin: -0.5, yMax: 7.4 },
        },
      ),
    ],
    sections: [
      paragraph(
        "Чтобы приблизить площадь под кривой, промежуток разбивают на много маленьких частей и на каждой строят прямоугольник подходящей высоты.",
      ),
      formula("S_n = \\sum_{i=1}^{n} f(\\xi_i)\\,\\Delta x_i", "Сумма Римана"),
      paragraph(
        "Чем мельче разбиение, тем точнее прямоугольники повторяют форму области. В пределе сумма Римана становится определённым интегралом.",
      ),
      formula(
        "\\int_a^b f(x)\\,dx = \\lim_{n\\to\\infty} \\sum_{i=1}^{n} f(\\xi_i)\\,\\Delta x_i",
        "Предел сумм Римана",
      ),
      practice([
        {
          id: "m3-basic",
          level: "Базовый",
          prompt: "Составьте левую сумму Римана для {{tex:f(x)=x}} на {{tex:[0,2]}} при {{tex:n=4}}.",
          answer: "Ответ: {{tex:1.5}}.",
          solution:
            "Ширина {{tex:\\Delta x = 0.5}}, левые точки: {{tex:0,0.5,1,1.5}}. Получаем {{tex:(0+0.5+1+1.5)\\cdot 0.5 = 1.5}}.",
          presetId: "riemann-left",
        },
        {
          id: "m3-medium",
          level: "Средний",
          prompt: "Найдите сумму по серединам для {{tex:f(x)=x^2}} на {{tex:[0,2]}} при {{tex:n=4}}.",
          answer: "Ответ: {{tex:2.625}}.",
          solution:
            "Середины: {{tex:0.25,0.75,1.25,1.75}}. Тогда {{tex:(0.25^2+0.75^2+1.25^2+1.75^2)\\cdot 0.5 = 2.625}}.",
          presetId: "riemann-mid",
        },
        {
          id: "m3-hard",
          level: "Сложный",
          prompt: "Найдите правую сумму Римана для {{tex:f(x)=2x+1}} на {{tex:[0,3]}} при {{tex:n=6}}.",
          answer: "Ответ: {{tex:13.5}}.",
          solution:
            "Шаг {{tex:\\Delta x=0.5}}, правые точки: {{tex:0.5,1,1.5,2,2.5,3}}. Значения функции: {{tex:2,3,4,5,6,7}}. Сумма равна {{tex:(2+3+4+5+6+7)\\cdot 0.5 = 13.5}}.",
          presetId: "riemann-right",
        },
      ]),
    ],
  },
  {
    id: "rectangles",
    title: "Левые, правые и средние прямоугольники",
    summary: "Разные способы выбора точки внутри каждого маленького отрезка дают разные приближения одного и того же интеграла.",
    presets: [
      preset(
        "rect-left",
        "Открыть пример с левыми прямоугольниками",
        "Функция {{tex:y=x+1}} на {{tex:[0,3]}} и левые прямоугольники.",
        {
          expressions: [{ text: "x + 1" }],
          tool: { mode: "riemann", a: 0, b: 3, n: 6, sample: "left", exprA: null },
          view: { xMin: -0.4, xMax: 3.4, yMin: -0.5, yMax: 4.6 },
        },
      ),
      preset(
        "rect-mid",
        "Открыть пример со средними прямоугольниками",
        "Та же функция, но высота берётся в середине каждого шага.",
        {
          expressions: [{ text: "x + 1" }],
          tool: { mode: "riemann", a: 0, b: 3, n: 6, sample: "mid", exprA: null },
          view: { xMin: -0.4, xMax: 3.4, yMin: -0.5, yMax: 4.6 },
        },
      ),
      preset(
        "rect-right",
        "Открыть пример в калькуляторе",
        "Правая сумма прямоугольников для функции {{tex:y=x+1}} на {{tex:[0,3]}} при {{tex:n=3}}.",
        {
          expressions: [{ text: "x + 1" }],
          tool: { mode: "riemann", a: 0, b: 3, n: 3, sample: "right", exprA: null },
          view: { xMin: -0.4, xMax: 3.4, yMin: -0.5, yMax: 4.6 },
        },
      ),
    ],
    sections: [
      paragraph(
        "В методе левых прямоугольников высота берётся в левом конце каждого промежутка, в методе правых — в правом, а в методе средних — в середине.",
      ),
      list(
        [
          "Для возрастающей функции левые прямоугольники обычно занижают ответ.",
          "Для возрастающей функции правые прямоугольники обычно завышают ответ.",
          "Средние прямоугольники часто дают заметно более точное приближение.",
        ],
        "Сравнение методов",
      ),
      formula(
        "S_n^{(\\text{mid})} = \\sum_{i=1}^{n} f\\!\\left(\\frac{x_{i-1}+x_i}{2}\\right)\\Delta x",
        "Формула для средних прямоугольников",
      ),
      practice([
        {
          id: "m4-basic",
          level: "Базовый",
          prompt: "Найдите левую сумму для {{tex:f(x)=x+1}} на {{tex:[0,3]}} при {{tex:n=3}}.",
          answer: "Ответ: {{tex:6}}.",
          solution:
            "Шаг равен {{tex:1}}, левые точки: {{tex:0,1,2}}. Значения функции: {{tex:1,2,3}}. Сумма: {{tex:(1+2+3)\\cdot 1 = 6}}.",
          presetId: "rect-left",
        },
        {
          id: "m4-medium",
          level: "Средний",
          prompt: "Найдите правую сумму для {{tex:f(x)=x+1}} на {{tex:[0,3]}} при {{tex:n=3}}.",
          answer: "Ответ: {{tex:9}}.",
          solution:
            "Правые точки: {{tex:1,2,3}}. Значения функции: {{tex:2,3,4}}. Получаем {{tex:(2+3+4)\\cdot 1 = 9}}.",
          presetId: "rect-right",
        },
        {
          id: "m4-hard",
          level: "Сложный",
          prompt: "Найдите сумму средних прямоугольников для {{tex:f(x)=x^2}} на {{tex:[0,2]}} при {{tex:n=4}}.",
          answer: "Ответ: {{tex:2.625}}.",
          solution:
            "Середины: {{tex:0.25,0.75,1.25,1.75}}. Тогда {{tex:(0.25^2+0.75^2+1.25^2+1.75^2)\\cdot 0.5 = 2.625}}. Это ближе к точному значению {{tex:\\frac83}}.",
          presetId: "rect-mid",
        },
      ]),
    ],
  },
  {
    id: "properties",
    title: "Свойства определённого интеграла",
    summary: "Линейность, аддитивность по промежутку и свойства симметрии позволяют быстро упрощать вычисления ещё до нахождения первообразной.",
    presets: [
      preset(
        "properties-linear",
        "Открыть пример в калькуляторе",
        "Линейность удобно проверять на функции {{tex:y=2x+3}} на {{tex:[0,1]}}.",
        {
          expressions: [{ text: "2x + 3" }],
          tool: { mode: "under", a: 0, b: 1, exprA: null },
          view: { xMin: -0.2, xMax: 1.2, yMin: -0.5, yMax: 5.5 },
        },
      ),
      preset(
        "properties-additivity",
        "Открыть пример в калькуляторе",
        "Аддитивность по промежутку можно увидеть на графике {{tex:y=x}} на {{tex:[0,3]}}.",
        {
          expressions: [{ text: "x" }],
          tool: { mode: "under", a: 0, b: 3, exprA: null },
          view: { xMin: -0.4, xMax: 3.4, yMin: -0.5, yMax: 5 },
        },
      ),
      preset(
        "properties-odd",
        "Открыть пример в калькуляторе",
        "Нечётная функция {{tex:y=x^3}} на симметричном промежутке {{tex:[-2,2]}}.",
        {
          expressions: [{ text: "x^3" }],
          tool: { mode: "under", a: -2, b: 2, exprA: null },
          view: { xMin: -2.5, xMax: 2.5, yMin: -9, yMax: 9 },
        },
      ),
    ],
    sections: [
      formula("\\int_a^b (\\alpha f(x)+\\beta g(x))\\,dx = \\alpha\\int_a^b f(x)\\,dx + \\beta\\int_a^b g(x)\\,dx", "Линейность"),
      formula("\\int_a^b f(x)\\,dx = \\int_a^c f(x)\\,dx + \\int_c^b f(x)\\,dx", "Аддитивность по промежутку"),
      formula("\\int_{-a}^{a} f(x)\\,dx = 0 \\quad \\text{для нечётной } f", "Симметрия для нечётной функции"),
      callout(
        "Если функцию удаётся узнать как чётную или нечётную, часть работы можно выполнить ещё до вычисления первообразной.",
        "Полезная эвристика",
        "violet",
      ),
      practice([
        {
          id: "m5-basic",
          level: "Базовый",
          prompt: "Используя линейность, вычислите {{tex:\\int_0^1 (2x+3)\\,dx}}.",
          answer: "Ответ: {{tex:4}}.",
          solution:
            "Можно считать сразу или разбить: {{tex:2\\int_0^1 x\\,dx + 3\\int_0^1 1\\,dx = 2\\cdot\\frac12 + 3\\cdot 1 = 4}}.",
          presetId: "properties-linear",
        },
        {
          id: "m5-medium",
          level: "Средний",
          prompt: "Покажите по свойству аддитивности, что {{tex:\\int_0^3 x\\,dx = \\int_0^1 x\\,dx + \\int_1^3 x\\,dx}} и найдите число.",
          answer: "Ответ: {{tex:\\frac92}}.",
          solution:
            "Левая часть равна {{tex:\\left.\\frac{x^2}{2}\\right|_0^3 = \\frac92}}. Правая часть: {{tex:\\frac12 + 4 = \\frac92}}.",
          presetId: "properties-additivity",
        },
        {
          id: "m5-hard",
          level: "Сложный",
          prompt: "Вычислите {{tex:\\int_{-2}^{2} x^3\\,dx}} без нахождения первообразной.",
          answer: "Ответ: {{tex:0}}.",
          solution:
            "Функция {{tex:x^3}} нечётная, а промежуток симметричен относительно нуля, поэтому интеграл равен нулю.",
          presetId: "properties-odd",
        },
      ]),
    ],
  },
  {
    id: "newton-leibniz",
    title: "Формула Ньютона–Лейбница",
    summary: "Определённый интеграл можно вычислять через первообразную: интеграл на отрезке равен приращению первообразной на концах этого отрезка.",
    presets: [
      preset(
        "newton-demo",
        "Открыть пример в калькуляторе",
        "Учебный режим Ньютона–Лейбница для функции {{tex:y=x^2}} на {{tex:[0,2]}}.",
        {
          expressions: [{ text: "x^2" }],
          tool: { mode: "newtonLeibniz", a: 0, b: 2, exprA: null },
          view: { xMin: -0.4, xMax: 2.4, yMin: -0.5, yMax: 4.6 },
        },
      ),
      preset(
        "newton-sine",
        "Открыть пример в калькуляторе",
        "Режим Ньютона–Лейбница для {{tex:y=\\sin x}} на {{tex:[0,\\pi]}}.",
        {
          expressions: [{ text: "sin(x)" }],
          tool: { mode: "newtonLeibniz", a: 0, b: Math.PI, exprA: null },
          view: { xMin: -0.3, xMax: 3.5, yMin: -0.2, yMax: 1.4 },
        },
      ),
      preset(
        "newton-log",
        "Открыть пример в калькуляторе",
        "Режим Ньютона–Лейбница для {{tex:y=\\frac1x}} на {{tex:[1,e^2]}}.",
        {
          expressions: [{ text: "1 / x" }],
          tool: { mode: "newtonLeibniz", a: 1, b: Math.E ** 2, exprA: null },
          view: { xMin: 0.6, xMax: 7.8, yMin: -0.1, yMax: 1.2 },
        },
      ),
    ],
    sections: [
      paragraph(
        "Если {{tex:F'(x)=f(x)}}, то определённый интеграл вычисляется по формуле {{tex:\\int_a^b f(x)\\,dx = F(b)-F(a)}}.",
      ),
      formula("\\int_a^b f(x)\\,dx = F(b)-F(a)", "Формула Ньютона–Лейбница"),
      paragraph(
        "Идея в том, что интеграл измеряет накопление, а первообразная хранит это накопление в явном виде.",
      ),
      callout(
        "В калькуляторе этот режим остаётся учебно-визуальным: он показывает смысл теоремы и численный результат, но не строит первообразную автоматически.",
        "Ограничение режима",
        "amber",
      ),
      practice([
        {
          id: "m6-basic",
          level: "Базовый",
          prompt: "Вычислите {{tex:\\int_0^2 x^2\\,dx}} по формуле Ньютона–Лейбница.",
          answer: "Ответ: {{tex:\\frac83}}.",
          solution:
            "Первообразная: {{tex:F(x)=\\frac{x^3}{3}}}. Тогда {{tex:\\left.\\frac{x^3}{3}\\right|_0^2 = \\frac83}}.",
          presetId: "newton-demo",
        },
        {
          id: "m6-medium",
          level: "Средний",
          prompt: "Вычислите {{tex:\\int_0^{\\pi} \\sin x\\,dx}}.",
          answer: "Ответ: {{tex:2}}.",
          solution:
            "Первообразная для {{tex:\\sin x}} — {{tex:-\\cos x}}. Поэтому {{tex:\\left.-\\cos x\\right|_0^{\\pi} = -(-1)-(-1)=2}}.",
          presetId: "newton-sine",
        },
        {
          id: "m6-hard",
          level: "Сложный",
          prompt: "Вычислите {{tex:\\int_1^{e^2} \\frac{1}{x}\\,dx}}.",
          answer: "Ответ: {{tex:2}}.",
          solution:
            "Первообразная: {{tex:\\ln x}}. Тогда {{tex:\\left.\\ln x\\right|_1^{e^2} = 2-0 = 2}}.",
          presetId: "newton-log",
        },
      ]),
    ],
  },
  {
    id: "area-by-integral",
    title: "Площадь через определённый интеграл",
    summary: "Чтобы найти геометрическую площадь, нужно учитывать знак функции и при необходимости разбивать промежуток по точкам пересечения с осью Ox.",
    presets: [
      preset(
        "area-direct",
        "Открыть пример в калькуляторе",
        "Площадь под неотрицательной функцией {{tex:y=x^2}} на {{tex:[0,2]}}.",
        {
          expressions: [{ text: "x^2" }],
          tool: { mode: "under", a: 0, b: 2, exprA: null },
          view: { xMin: -0.4, xMax: 2.4, yMin: -0.5, yMax: 4.6 },
        },
      ),
      preset(
        "area-sign-change",
        "Открыть пример со сменой знака",
        "Функция {{tex:y=x^2-1}} пересекает ось {{tex:Ox}} и требует разбиения промежутка.",
        {
          expressions: [{ text: "x^2 - 1" }],
          tool: { mode: "under", a: -2, b: 2, exprA: null },
          view: { xMin: -2.4, xMax: 2.4, yMin: -1.8, yMax: 3.8 },
        },
      ),
      preset(
        "area-arch",
        "Открыть пример в калькуляторе",
        "Функция {{tex:y=1-x^2}} на {{tex:[-1,1]}} остаётся над осью и даёт дугообразную площадь.",
        {
          expressions: [{ text: "1 - x^2" }],
          tool: { mode: "under", a: -1, b: 1, exprA: null },
          view: { xMin: -1.4, xMax: 1.4, yMin: -0.3, yMax: 1.5 },
        },
      ),
    ],
    sections: [
      paragraph(
        "Если функция не меняет знак на промежутке, площадь совпадает с интегралом или с его противоположным значением.",
      ),
      formula("S = \\int_a^b |f(x)|\\,dx", "Универсальная формула площади"),
      paragraph(
        "Если график пересекает ось {{tex:Ox}}, нужно найти точки, где {{tex:f(x)=0}}, разбить промежуток на части и сложить обычные площади по отдельности.",
      ),
      list(
        [
          "Понять, где функция выше и где ниже оси.",
          "Найти точки смены знака.",
          "Разбить промежуток на части.",
          "Сложить площади как положительные числа.",
        ],
        "Алгоритм",
      ),
      practice([
        {
          id: "m7-basic",
          level: "Базовый",
          prompt: "Найдите площадь под графиком {{tex:y=x^2}} на {{tex:[0,2]}}.",
          answer: "Ответ: {{tex:\\frac83}}.",
          solution:
            "На {{tex:[0,2]}} функция неотрицательна, поэтому площадь равна интегралу {{tex:\\int_0^2 x^2\\,dx = \\left.\\frac{x^3}{3}\\right|_0^2 = \\frac83}}.",
          presetId: "area-direct",
        },
        {
          id: "m7-medium",
          level: "Средний",
          prompt: "Найдите площадь фигуры под графиком {{tex:y=1-x^2}} на {{tex:[-1,1]}}.",
          answer: "Ответ: {{tex:\\frac43}}.",
          solution:
            "На всём отрезке функция неотрицательна, значит {{tex:S=\\int_{-1}^1 (1-x^2)\\,dx = \\left.(x-\\frac{x^3}{3})\\right|_{-1}^{1} = \\frac43}}.",
          presetId: "area-arch",
        },
        {
          id: "m7-hard",
          level: "Сложный",
          prompt: "Найдите геометрическую площадь для {{tex:y=x^2-1}} на {{tex:[-2,2]}}.",
          answer: "Ответ: {{tex:4}}.",
          solution:
            "Нули: {{tex:x=\\pm1}}. Внешние участки дают площадь {{tex:\\int_1^2 (x^2-1)\\,dx = \\frac43}} с каждой стороны, центральный участок даёт {{tex:\\int_{-1}^{1}(1-x^2)\\,dx = \\frac43}}. Итог: {{tex:\\frac43+\\frac43+\\frac43=4}}.",
          presetId: "area-sign-change",
        },
      ]),
    ],
  },
  {
    id: "between-graphs",
    title: "Площадь между двумя графиками",
    summary: "Высота фигуры равна разности верхней и нижней функций, поэтому перед интегрированием нужно определить, какой график выше на каждом участке.",
    presets: [
      preset(
        "between-basic",
        "Открыть пример в калькуляторе",
        "Площадь между {{tex:y=x}} и {{tex:y=x^2}} на {{tex:[0,1]}}.",
        {
          expressions: [{ text: "x" }, { text: "x^2" }],
          tool: { mode: "between", a: 0, b: 1, exprA: null, exprB: null },
          view: { xMin: -0.2, xMax: 1.2, yMin: -0.2, yMax: 1.2 },
        },
      ),
      preset(
        "between-switch",
        "Открыть пример со сменой верхней функции",
        "Графики {{tex:y=x}} и {{tex:y=x^3}} меняются местами на разных участках {{tex:[-1,1]}}.",
        {
          expressions: [{ text: "x" }, { text: "x^3" }],
          tool: { mode: "between", a: -1, b: 1, exprA: null, exprB: null },
          view: { xMin: -1.3, xMax: 1.3, yMin: -1.2, yMax: 1.2 },
        },
      ),
      preset(
        "between-parabola-line",
        "Открыть пример в калькуляторе",
        "Площадь между {{tex:y=2x}} и {{tex:y=x^2}} на {{tex:[0,2]}}.",
        {
          expressions: [{ text: "2x" }, { text: "x^2" }],
          tool: { mode: "between", a: 0, b: 2, exprA: null, exprB: null },
          view: { xMin: -0.2, xMax: 2.2, yMin: -0.2, yMax: 4.5 },
        },
      ),
    ],
    sections: [
      paragraph(
        "Если область ограничена графиками {{tex:y=f(x)}} и {{tex:y=g(x)}}, то её высота в каждой точке равна разности верхней и нижней функций.",
      ),
      formula("S = \\int_a^b \\bigl(f(x)-g(x)\\bigr)\\,dx", "Базовая формула"),
      paragraph(
        "Если графики пересекаются, нужно разбить промежуток по точкам пересечения и на каждом участке заново определить, кто сверху, а кто снизу.",
      ),
      callout(
        "Нельзя бездумно писать одну разность на всём промежутке: при смене порядка графиков знак площади изменится.",
        "Типичная ошибка",
        "rose",
      ),
      practice([
        {
          id: "m8-basic",
          level: "Базовый",
          prompt: "Найдите площадь между {{tex:y=x}} и {{tex:y=x^2}} на {{tex:[0,1]}}.",
          answer: "Ответ: {{tex:\\frac16}}.",
          solution:
            "На {{tex:[0,1]}} сверху находится {{tex:y=x}}, снизу — {{tex:y=x^2}}. Поэтому {{tex:S=\\int_0^1 (x-x^2)\\,dx = \\frac16}}.",
          presetId: "between-basic",
        },
        {
          id: "m8-medium",
          level: "Средний",
          prompt: "Найдите площадь между {{tex:y=2x}} и {{tex:y=x^2}} на {{tex:[0,2]}}.",
          answer: "Ответ: {{tex:\\frac43}}.",
          solution:
            "На {{tex:[0,2]}} прямая {{tex:y=2x}} выше параболы. Тогда {{tex:S=\\int_0^2 (2x-x^2)\\,dx = \\left.(x^2-\\frac{x^3}{3})\\right|_0^2 = \\frac43}}.",
          presetId: "between-parabola-line",
        },
        {
          id: "m8-hard",
          level: "Сложный",
          prompt: "Найдите площадь между {{tex:y=x}} и {{tex:y=x^3}} на {{tex:[-1,1]}}.",
          answer: "Ответ: {{tex:\\frac12}}.",
          solution:
            "На {{tex:[-1,0]}} сверху {{tex:x^3}}, а на {{tex:[0,1]}} сверху {{tex:x}}. Поэтому {{tex:S=\\int_{-1}^0 (x^3-x)\\,dx + \\int_0^1 (x-x^3)\\,dx = 2\\int_0^1 (x-x^3)\\,dx = \\frac12}}.",
          presetId: "between-switch",
        },
      ]),
    ],
  },
  {
    id: "average-value",
    title: "Теорема о среднем",
    summary: "Теорема о среднем связывает интеграл с прямоугольником той же площади: высота этого прямоугольника и есть f_ср.",
    presets: [
      preset(
        "average-demo",
        "Открыть пример в калькуляторе",
        "Теорема о среднем для {{tex:y=x^2}} на отрезке {{tex:[0,3]}}.",
        {
          expressions: [{ text: "x^2" }],
          tool: { mode: "averageValue", a: 0, b: 3, exprA: null },
          view: { xMin: -0.4, xMax: 3.4, yMin: -0.5, yMax: 9.5 },
        },
      ),
      preset(
        "average-sine",
        "Открыть пример с синусом",
        "Теорема о среднем для {{tex:y=\\sin x}} на {{tex:[0,\\pi]}}.",
        {
          expressions: [{ text: "sin(x)" }],
          tool: { mode: "averageValue", a: 0, b: Math.PI, exprA: null },
          view: { xMin: -0.3, xMax: 3.5, yMin: -0.2, yMax: 1.4 },
        },
      ),
      preset(
        "average-log",
        "Открыть пример в калькуляторе",
        "Теорема о среднем для {{tex:y=\\frac1x}} на {{tex:[1,e^2]}}.",
        {
          expressions: [{ text: "1 / x" }],
          tool: { mode: "averageValue", a: 1, b: Math.E ** 2, exprA: null },
          view: { xMin: 0.6, xMax: 7.8, yMin: -0.1, yMax: 1.2 },
        },
      ),
    ],
    sections: [
      paragraph(
        "Если функция непрерывна на {{tex:[a,b]}}, то её среднее значение удобно понимать через площадь: фигуру под графиком можно заменить прямоугольником той же ширины и такой высоты, чтобы площадь не изменилась.",
      ),
      formula("\\int_a^b f(x)\\,dx = f_{\\text{ср}}(b-a)", "Главная формула"),
      paragraph(
        "Эта запись сразу показывает геометрический смысл: слева стоит площадь под графиком, а справа — площадь прямоугольника ширины {{tex:b-a}} и высоты {{tex:f_{\\text{ср}}}}.",
      ),
      formula("f_{\\text{ср}} = \\frac{1}{b-a}\\int_a^b f(x)\\,dx", "Формула как следствие"),
      paragraph(
        "Сначала удобно думать именно через прямоугольник той же площади, а деление на длину отрезка воспринимать как последний шаг вычисления.",
      ),
      callout(
        "Не путайте число {{tex:f_{\\text{ср}}}} и точку {{tex:c}}. Если функция непрерывна, то найдётся точка {{tex:c\\in[a,b]}}, где {{tex:f(c)=f_{\\text{ср}}}}, но {{tex:f_{\\text{ср}}}} — это именно значение, а не координата точки.",
        "Что важно не перепутать",
        "emerald",
      ),
      practice([
        {
          id: "m9-basic",
          level: "Базовый",
          prompt: "Примените теорему о среднем для {{tex:f(x)=x^2}} на {{tex:[0,3]}}.",
          answer: "Ответ: {{tex:3}}.",
          solution:
            "Сначала используем главную запись: {{tex:3\\cdot f_{\\text{ср}} = \\int_0^3 x^2\\,dx}}. Интеграл равен {{tex:9}}, значит {{tex:3\\cdot f_{\\text{ср}} = 9}}, откуда {{tex:f_{\\text{ср}}=3}}.",
          presetId: "average-demo",
        },
        {
          id: "m9-medium",
          level: "Средний",
          prompt: "Примените теорему о среднем для {{tex:f(x)=\\sin x}} на {{tex:[0,\\pi]}}.",
          answer: "Ответ: {{tex:\\frac{2}{\\pi}}}.",
          solution:
            "Пишем связь площади и прямоугольника: {{tex:\\pi\\cdot f_{\\text{ср}} = \\int_0^{\\pi} \\sin x\\,dx}}. Интеграл равен {{tex:2}}, поэтому {{tex:\\pi\\cdot f_{\\text{ср}} = 2}}, значит {{tex:f_{\\text{ср}}=\\frac{2}{\\pi}}}.",
          presetId: "average-sine",
        },
        {
          id: "m9-hard",
          level: "Сложный",
          prompt: "Примените теорему о среднем для {{tex:f(x)=\\frac1x}} на {{tex:[1,e^2]}}.",
          answer: "Ответ: {{tex:\\frac{2}{e^2-1}}}.",
          solution:
            "Сначала записываем {{tex:(e^2-1)\\cdot f_{\\text{ср}}=\\int_1^{e^2}\\frac1x\\,dx}}. Интеграл равен {{tex:2}}, поэтому {{tex:(e^2-1)\\cdot f_{\\text{ср}}=2}} и {{tex:f_{\\text{ср}}=\\frac{2}{e^2-1}}}.",
          presetId: "average-log",
        },
      ]),
    ],
  },
  {
    id: "volume-and-numerics",
    title: "Объём тела вращения и численные методы",
    summary: "Определённый интеграл работает не только с площадями: через него находят объёмы тел вращения и приближённые значения по численным схемам.",
    presets: [
      preset(
        "volume-demo",
        "Открыть пример объёма в калькуляторе",
        "Тело вращения для графика {{tex:y=x}} на {{tex:[0,2]}} вокруг оси {{tex:Ox}}.",
        {
          expressions: [{ text: "x" }],
          tool: { mode: "volume", a: 0, b: 2, exprA: null },
          view: { xMin: -0.4, xMax: 2.4, yMin: -0.5, yMax: 2.5 },
        },
      ),
      preset(
        "trap-demo",
        "Открыть пример метода трапеций",
        "Численное приближение для {{tex:\\int_0^2 x^2\\,dx}} методом трапеций.",
        {
          expressions: [{ text: "x^2" }],
          tool: { mode: "trap", a: 0, b: 2, n: 4, exprA: null },
          view: { xMin: -0.4, xMax: 2.4, yMin: -0.5, yMax: 4.6 },
        },
      ),
      preset(
        "volume-root",
        "Открыть пример в калькуляторе",
        "Тело вращения для {{tex:y=\\sqrt{x}}} на {{tex:[0,4]}} вокруг оси {{tex:Ox}}.",
        {
          expressions: [{ text: "sqrt(x)" }],
          tool: { mode: "volume", a: 0, b: 4, exprA: null },
          view: { xMin: -0.4, xMax: 4.4, yMin: -0.3, yMax: 2.8 },
        },
      ),
    ],
    sections: [
      paragraph(
        "Если область под графиком вращается вокруг оси {{tex:Ox}}, то каждое сечение тела — круг, и его площадь описывается формулой {{tex:\\pi r^2}}.",
      ),
      formula("V = \\pi \\int_a^b \\bigl(f(x)\\bigr)^2\\,dx", "Объём тела вращения"),
      paragraph(
        "Когда точное вычисление неудобно, используют численные методы: кривую заменяют более простой фигурой и получают приближённый ответ.",
      ),
      formula(
        "\\int_a^b f(x)\\,dx \\approx \\frac{h}{2}\\Bigl(f(x_0)+2\\sum_{i=1}^{n-1} f(x_i)+f(x_n)\\Bigr)",
        "Метод трапеций",
      ),
      practice([
        {
          id: "m10-basic",
          level: "Базовый",
          prompt: "Найдите объём тела, полученного вращением графика {{tex:y=x}} на {{tex:[0,2]}} вокруг оси {{tex:Ox}}.",
          answer: "Ответ: {{tex:\\frac{8\\pi}{3}}}.",
          solution:
            "Используем формулу дисков: {{tex:V=\\pi\\int_0^2 x^2\\,dx = \\pi\\cdot\\frac83 = \\frac{8\\pi}{3}}}.",
          presetId: "volume-demo",
        },
        {
          id: "m10-medium",
          level: "Средний",
          prompt: "Приближённо вычислите {{tex:\\int_0^2 x^2\\,dx}} методом трапеций при {{tex:n=4}}.",
          answer: "Ответ: {{tex:2.75}}.",
          solution:
            "Шаг {{tex:h=0.5}}. Значения: {{tex:0,0.25,1,2.25,4}}. Тогда {{tex:T_4=\\frac{0.5}{2}(0+2(0.25+1+2.25)+4)=2.75}}.",
          presetId: "trap-demo",
        },
        {
          id: "m10-hard",
          level: "Сложный",
          prompt: "Найдите объём тела, полученного вращением графика {{tex:y=\\sqrt{x}}} на {{tex:[0,4]}} вокруг оси {{tex:Ox}}.",
          answer: "Ответ: {{tex:8\\pi}}.",
          solution:
            "Здесь {{tex:(\\sqrt{x})^2=x}}, поэтому {{tex:V=\\pi\\int_0^4 x\\,dx = \\pi\\left.\\frac{x^2}{2}\\right|_0^4 = 8\\pi}}.",
          presetId: "volume-root",
        },
      ]),
    ],
  },
];
