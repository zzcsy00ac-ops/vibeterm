import { getCurrentWindow,Window } from "@tauri-apps/api/window";
import { useEffect, useState } from "react";

const createMockWindow = ():Window => {
    const mockWindow = {
        label: "",
        close: async () => {},
        hide: async () => {},
        show: async () => {},
        startDragging: async () => {},
    } as any
    return mockWindow as Window;
}

export function useTauriWindow() {
    const [appWindow, setAppWindow] = useState<Window>(createMockWindow());
    const [isTauri, setIsTauri] = useState<boolean>(false);

    useEffect(()=>{
        const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;

        setIsTauri(isTauri);

        try {
            if (isTauri) {
                const window = getCurrentWindow();
                setAppWindow(window);
            } else {
                setAppWindow(createMockWindow())
            }
        } catch(error) {
            console.error('Failed to get Tauri window: ',error)
            setAppWindow(createMockWindow())
        }
    },[])

    return {appWindow,isTauri}

}