//AppInsights.js file
import { ApplicationInsights } from '@microsoft/applicationinsights-web';
import { ReactPlugin } from '@microsoft/applicationinsights-react-js';

const reactPlugin = new ReactPlugin();

const appInsights = new ApplicationInsights({
  config: {
    connectionString: import.meta.env.VITE_AI_CONNECTION_STRING,
    extensions: [reactPlugin],
    enableAutoRouteTracking: true,
    disableFetchTracking: false,
  }
});

appInsights.loadAppInsights();

export { reactPlugin, appInsights };