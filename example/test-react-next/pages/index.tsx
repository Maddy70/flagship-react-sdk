import { HitType, useFlagship, useFsFlag } from "@flagship.io/react-sdk";
import type { NextPage } from "next";
import styles from "../styles/Home.module.css";

const Index: NextPage = () => {
  const fs = useFlagship();

  const btnColorFlag = useFsFlag("js-qa-app", "default");

  const onSendHitClick = () => {
    fs.hit.sendMultiple([
      { type: HitType.PAGE_VIEW, documentLocation: "abtastylab" },
      { type: HitType.SCREEN, documentLocation: "abtastylab" },
    ]);
  };

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        <p>flag key: js-qa-app</p>
        <p>value: {btnColorFlag.getValue()}</p>

        <button
          style={{ width: 100, height: 50 }}
          onClick={() => {
            onSendHitClick();
          }}
        >
          {" "}
          Send hits
        </button>
      </main>
    </div>
  );
};

export default Index;
