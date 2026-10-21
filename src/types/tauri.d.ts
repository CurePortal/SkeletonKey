// src/types/tauri.d.ts

declare global {
  interface Window {
    __TAURI__?: {
      app?: {
        getVersion(): Promise<string>;
        getName(): Promise<string>;
        getTauriVersion(): Promise<string>;
      };
      os?: {
        platform(): Promise<string>;
        version(): Promise<string>;
        type(): Promise<string>;
        arch(): Promise<string>;
        tempdir(): Promise<string>;
        locale(): Promise<string>;
      };
      path?: {
        appDir(): Promise<string>;
        audioDir(): Promise<string>;
        cacheDir(): Promise<string>;
        configDir(): Promise<string>;
        dataDir(): Promise<string>;
        desktopDir(): Promise<string>;
        documentDir(): Promise<string>;
        downloadDir(): Promise<string>;
        executableDir(): Promise<string>;
        fontDir(): Promise<string>;
        homeDir(): Promise<string>;
        localDataDir(): Promise<string>;
        pictureDir(): Promise<string>;
        publicDir(): Promise<string>;
        resourceDir(): Promise<string>;
        runtimeDir(): Promise<string>;
        templateDir(): Promise<string>;
        videoDir(): Promise<string>;
      };
      fs?: {
        readTextFile(path: string): Promise<string>;
        writeTextFile(path: string, contents: string): Promise<void>;
        readFile(path: string): Promise<Uint8Array>;
        writeBinaryFile(path: string, contents: Uint8Array): Promise<void>;
        exists(path: string): Promise<boolean>;
        createDir(
          path: string,
          options?: { recursive?: boolean },
        ): Promise<void>;
        removeDir(
          path: string,
          options?: { recursive?: boolean },
        ): Promise<void>;
        removeFile(path: string): Promise<void>;
        renameFile(oldPath: string, newPath: string): Promise<void>;
        copyFile(source: string, destination: string): Promise<void>;
        metadata(path: string): Promise<{
          isDir: boolean;
          isFile: boolean;
          isSymlink: boolean;
          size: number;
          modifiedAt: Date;
          accessedAt: Date;
          createdAt: Date;
        }>;
        readDir(path: string): Promise<
          {
            name: string;
            path: string;
            children?: any[];
          }[]
        >;
      };
      window?: {
        getCurrent(): any;
        getAll(): any[];
        create(label: string, options?: any): Promise<any>;
      };
      event?: {
        listen<T>(
          event: string,
          handler: (event: { payload: T }) => void,
        ): Promise<() => void>;
        once<T>(
          event: string,
          handler: (event: { payload: T }) => void,
        ): Promise<() => void>;
        emit(event: string, payload?: any): Promise<void>;
      };
      invoke?: (command: string, args?: Record<string, any>) => Promise<any>;
      dialog?: {
        open(options?: {
          defaultPath?: string;
          directory?: boolean;
          multiple?: boolean;
          filters?: { name: string; extensions: string[] }[];
          title?: string;
        }): Promise<string | string[] | null>;
        save(options?: {
          defaultPath?: string;
          filters?: { name: string; extensions: string[] }[];
          title?: string;
        }): Promise<string | null>;
        message(
          message: string,
          options?: {
            title?: string;
            type?: "info" | "warning" | "error";
          },
        ): Promise<void>;
        ask(
          message: string,
          options?: {
            title?: string;
            type?: "info" | "warning" | "error";
          },
        ): Promise<boolean>;
        confirm(
          message: string,
          options?: {
            title?: string;
            type?: "info" | "warning" | "error";
          },
        ): Promise<boolean>;
      };
      notification?: {
        sendNotification(
          options:
            | string
            | {
                title?: string;
                body?: string;
                icon?: string;
              },
        ): void;
        requestPermission(): Promise<"granted" | "denied" | "default">;
        isPermissionGranted(): Promise<boolean>;
      };
      globalShortcut?: {
        register(shortcut: string, handler: () => void): Promise<void>;
        registerAll(shortcuts: string[], handler: () => void): Promise<void>;
        isRegistered(shortcut: string): Promise<boolean>;
        unregister(shortcut: string): Promise<void>;
        unregisterAll(): Promise<void>;
      };
      shell?: {
        open(path: string): Promise<void>;
        Command: new (
          command: string,
          args?: string[],
        ) => {
          execute(): Promise<{
            code: number;
            signal: number;
            stdout: string;
            stderr: string;
          }>;
          spawn(): Promise<any>;
          kill(): Promise<void>;
        };
      };
      http?: {
        fetch(
          url: string,
          options?: {
            method?: string;
            headers?: Record<string, string>;
            body?: any;
            timeout?: number;
          },
        ): Promise<{
          url: string;
          status: number;
          headers: Record<string, string>;
          data: any;
        }>;
      };
      clipboard?: {
        writeText(text: string): Promise<void>;
        readText(): Promise<string>;
      };
      theme?: {
        getCurrent(): Promise<"light" | "dark">;
      };
    };
  }

  // Extend Navigator interface for better browser API support
  interface Navigator {
    memory?: {
      usedJSHeapSize: number;
      totalJSHeapSize: number;
      jsHeapSizeLimit: number;
    };
    connection?: {
      effectiveType: string;
      downlink: number;
      rtt: number;
      saveData: boolean;
    };
  }

  // Extend Performance interface
  interface Performance {
    memory?: {
      usedJSHeapSize: number;
      totalJSHeapSize: number;
      jsHeapSizeLimit: number;
    };
  }
}

export {};
