import { render } from "ink";
import { Provider } from "jotai";
import { App } from "./App.js";
import { store } from "./store.ts";

/**
 * startCli renders the Ink application showing live logs and a command input.
 */
export function startCli(props: { onCommand: (command: string) => void }) {
  render(
    <Provider store={store}>
      <App onCommand={props.onCommand} />
    </Provider>
  );
}
