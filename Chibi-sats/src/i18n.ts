import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

i18n
  .use(initReactI18next) // passes i18n down to react-i18next
  .init({
    resources: {
      en: {
        translation: {
          "Chibi Sats": "Chibi Sats",
          "BTC": "BTC",
          "Loading...": "Loading...",
          "No connection to Bybit API, trying again": "No connection to Bybit API, trying again",
          "24 hours": "24 hours",
          "1 week": "1 week",
          "1 month": "1 month",
          "1 year": "1 year",
          "Launch at startup": "Launch at startup",
          "Close Application": "Close Application",
          "Light": "Light",
          "Dark": "Dark",
          "Anime": "Anime",
          "Billionaire": "Billionaire",
          "Dragon": "Golden Dragon",
          "English": "English",
          "Russian": "Russian",
          "Settings": "Settings",
          "Coming soon...": "Coming soon...",
          "Currency": "Currency",
          "Select Currency": "Select Currency",
          "US Dollar": "US Dollar",
          "Euro": "Euro",
          "Themes": "Themes",
          "Language": "Language",
          "About Developer": "About Developer",
          "24h": "24h",
          "1w": "1w",
          "1m": "1m",
          "1y": "1y",
          "Always on Top": "Always on Top",
          "Opacity": "Opacity",
          "Refresh Interval": "Refresh Interval",
          "Cryptocurrency": "Cryptocurrency",
          "sec": "sec",
          "min": "min",
          "Bender": "Bender",
          "Casino": "Blackjack and hookers",
          "Lord": "The Lord",
          "Price Alerts": "Price Alerts",
          "Target Price": "Target Price",
          "Theme": "Theme",
          "Manual Price": "Manual Price",
          "Use Manual Price": "Use Manual Price"
        }
      },
      ru: {
        translation: {
          "Chibi Sats": "Chibi Sats",
          "BTC": "BTC",
          "Loading...": "Загрузка...",
          "No connection to Bybit API, trying again": "Нет соединения с Bybit API, повторная попытка",
          "24 hours": "24 часа",
          "1 week": "1 неделя",
          "1 month": "1 месяц",
          "1 year": "1 год",
          "Launch at startup": "Автозапуск",
          "Close Application": "Закрыть приложение",
          "Light": "Светлая",
          "Dark": "Темная",
          "Anime": "Аниме",
          "Billionaire": "Миллиардер",
          "Dragon": "Золотой Дракон",
          "English": "Английский",
          "Russian": "Русский",
          "Settings": "Настройки",
          "Coming soon...": "Скоро здесь что-то будет...",
          "Currency": "Валюта",
          "Select Currency": "Выберите валюту",
          "US Dollar": "Доллар США",
          "Euro": "Евро",
          "Themes": "Темы",
          "Language": "Язык",
          "About Developer": "О разработчике",
          "24h": "24ч",
          "1w": "1н",
          "1m": "1м",
          "1y": "1г",
          "Always on Top": "Поверх всех окон",
          "Opacity": "Прозрачность",
          "Refresh Interval": "Интервал обновления",
          "Cryptocurrency": "Криптовалюта",
          "sec": "сек",
          "min": "мин",
          "Bender": "Бендер",
          "Casino": "Блэкджек и шлюхи",
          "Lord": "Властелин",
          "Price Alerts": "Уведомление о цене",
          "Target Price": "Целевая цена",
          "Theme": "Тема",
          "Manual Price": "Ручная цена",
          "Use Manual Price": "Использовать ручную цену"
        }
      }
    },
    lng: "en", // default language
    fallbackLng: "en",

    interpolation: {
      escapeValue: false // react already safes from xss
    }
  });

export default i18n;