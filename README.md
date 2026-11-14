# Expense & Budget Visualizer

A client-side web application to record daily expenses, categorize spending, and visualize spending distribution. Built with HTML, CSS, and Vanilla JavaScript — no backend, no framework, and no build step. All data persists in the browser's Local Storage.

## Features

### MVP Features

- **Add expenses** with item name, amount, and category (Food, Transport, Fun)
- **Input validation** with clear, inline error messages
- **Scrollable transaction history** with the ability to delete individual transactions
- **Total spending display** that updates in real time as transactions are added or removed
- **Spending distribution pie chart** (powered by Chart.js) broken down by category
- **Data persistence** via the browser Local Storage API
- **Responsive design** that works on desktop, tablet, and mobile
- **Dark/light mode** support

### Optional Features (Implemented)

- **Monthly summary** with month navigation and a per-category breakdown
- **Sort transactions** by amount or by category (display order only — saved data is unaffected)
- **Dark/Light mode toggle** with the selected theme persisted to Local Storage

## Tech Stack

- **HTML5** — semantic markup and structure
- **CSS3** — styling, theming, and responsive layout
- **Vanilla JavaScript** — application logic (no framework)
- **Chart.js** — pie chart rendering, loaded via CDN
- **Local Storage API** — client-side data persistence

## Project Structure

```
project/
├── .kiro/specs/expense-budget-visualizer/
│   ├── requirements.md
│   ├── design.md
│   └── tasks.md
├── css/
│   └── styles.css
├── js/
│   └── app.js
├── index.html
└── README.md
```

## How to Run

The app runs entirely in the browser — there is nothing to install and no build step.

1. Open `index.html` in any modern web browser (Chrome, Firefox, Edge, or Safari).

Alternatively, serve the folder with any static file server:

- **Python**: `python -m http.server` (then visit `http://localhost:8000`)
- **VS Code**: use the [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) extension

## GitHub Pages Deployment

The app is ready for static hosting with no configuration required.

1. Push the repository to GitHub.
2. Go to the repository **Settings > Pages**.
3. Under **Build and deployment**, select **Deploy from a branch**.
4. Select the **main** branch and the **root** folder.
5. Click **Save**.

The app will be available at `https://<username>.github.io/<repository-name>/`.

Because all asset paths are relative (`css/styles.css`, `js/app.js`), the app works without any path configuration.

## Browser Compatibility

- Google Chrome
- Mozilla Firefox
- Microsoft Edge
- Safari
