import './index.css'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './i18n.js'
import store from './store'
import { Provider } from 'react-redux'
import { registerSW } from 'virtual:pwa-register'

registerSW({ immediate: true })

ReactDOM.createRoot(document.getElementById('root')).render(
  // <React.StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  // </React.StrictMode>
)