//AppInsights.js file
import { ApplicationInsights } from '@microsoft/applicationinsights-web';
import { ReactPlugin } from '@microsoft/applicationinsights-react-js';

const reactPlugin = new ReactPlugin();

const connectionString = import.meta.env.VITE_AI_CONNECTION_STRING;

const appInsights = connectionString
  ? new ApplicationInsights({
      config: {
        connectionString,
        extensions: [reactPlugin],
        enableAutoRouteTracking: true,
        disableFetchTracking: false,
      }
    })
  : null;

if (appInsights) {
  appInsights.loadAppInsights();
}

export { reactPlugin, appInsights };