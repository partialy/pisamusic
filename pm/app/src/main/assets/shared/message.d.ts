type MessageType = 'success' | 'error' | 'info' | 'warning' | 'loading';
interface MessageOptions {
    duration?: number;
    color?: string;
    icon?: any;
    closable?: boolean;
}
declare class MessageManager {
    private container;
    constructor();
    private initContainer;
    private createIcon;
    show(content: string, type?: MessageType, options?: MessageOptions): {
        el: HTMLDivElement;
        close: () => void;
    };
    private remove;
    success(content: string, options?: MessageOptions): {
        el: HTMLDivElement;
        close: () => void;
    };
    error(content: string, options?: MessageOptions): {
        el: HTMLDivElement;
        close: () => void;
    };
    info(content: string, options?: MessageOptions): {
        el: HTMLDivElement;
        close: () => void;
    };
    warning(content: string, options?: MessageOptions): {
        el: HTMLDivElement;
        close: () => void;
    };
    loading(content: string, options?: MessageOptions): {
        el: HTMLDivElement;
        close: () => void;
    };
}
declare const message: MessageManager;

export { type MessageOptions, type MessageType, message };
