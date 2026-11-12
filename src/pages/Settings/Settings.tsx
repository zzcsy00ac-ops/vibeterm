import { Flex, Card } from "@radix-ui/themes";
import { Outlet } from "react-router-dom";
import { SettingsNav } from "./SettingsNav";
import { AppProvider } from "../../providers/AppProvider";
import "./Settings.css";

export default function Settings() {
  return (
    <AppProvider>
      <Flex gap="2" className="settings-page" p="4" style={{ height: "100dvh",backgroundColor:'var(--color-panel)' }}>
        {/* 左侧导航栏 */}
        <SettingsNav />

        {/* 右侧内容区 */}
       <Card style={{width:'100%',margin:"0px 0px",backgroundColor:'var(--color-background)'}}>
          <Outlet />
        </Card>
      </Flex>
    </AppProvider>
  );
}
