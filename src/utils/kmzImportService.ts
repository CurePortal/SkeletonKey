import JSZip from "jszip";
import { LocationType, AnchoredShape, Coordinates } from "../types";
import { getIconFromGoogleEarthUrl } from "../utils/mapIcons";

interface KMLPlacemark {
  name?: string;
  description?: string;
  coordinates: Coordinates[];
  type: "Point" | "LineString" | "Polygon" | "MultiGeometry";
  styleUrl?: string;
  extendedData?: Record<string, string>;
  iconHref?: string;
}

interface KMLStyle {
  id: string;
  lineColor?: string;
  lineWidth?: number;
  polyColor?: string;
  iconHref?: string;
  iconScale?: number;
  iconColor?: string;
}

interface ImportOptions {
  analyzeOnly?: boolean;
  iconMappings?: Record<string, string>;
  customIconsFolder?: FileList | null;
  preserveStyles?: boolean;
  createLocationsForPoints?: boolean;
}

interface ImportResult {
  success: boolean;
  data?: {
    locations: LocationType[];
    shapes: AnchoredShape[];
    styles: KMLStyle[];
    iconAnalysis?: {
      totalIcons: number;
      standardIcons: number;
      customIcons: number;
      mappings: Record<string, string>;
    };
  };
  error?: string;
  warnings?: string[];
}

export class EnhancedKMZImportService {
  private static customIconCache: Map<string, { url: string; name: string }> =
    new Map();

  static async importKMZ(
    file: File,
    timelineId?: string,
    options: ImportOptions = {},
  ): Promise<ImportResult> {
    try {
      console.log("Starting enhanced KMZ/KML import for file:", file.name);

      this.customIconCache.clear();

      let kmlContent: string;
      let kmzFiles: JSZip | null = null;

      if (file.name.toLowerCase().endsWith(".kml")) {
        console.log("Processing KML file directly");
        kmlContent = await file.text();
      } else {
        console.log("Processing KMZ file");
        const zip = new JSZip();
        kmzFiles = await zip.loadAsync(file);
        const kmlFile = kmzFiles.file(/\.kml$/i)[0];
        if (!kmlFile) {
          return { success: false, error: "No KML file found in KMZ archive" };
        }
        kmlContent = await kmlFile.async("string");
      }

      const parser = new DOMParser();
      const kmlDoc = parser.parseFromString(kmlContent, "text/xml");

      if (kmlDoc.getElementsByTagName("parsererror").length > 0) {
        return { success: false, error: "Invalid KML format" };
      }

      if (kmzFiles) {
        await this.processIconsFromKMZ(kmzFiles);
      }
      if (options.customIconsFolder) {
        await this.processIconsFromUserFiles(options.customIconsFolder);
      }

      const styles = this.extractStyles(kmlDoc);
      const placemarks = this.extractPlacemarks(kmlDoc);

      console.log("Extracted:", placemarks.length, "placemarks");
      console.log("Extracted:", styles.length, "styles");

      if (placemarks.length === 0) {
        return {
          success: false,
          error: "No valid placemarks found in KML file.",
        };
      }

      const { locations, shapes, warnings, iconAnalysis } =
        await this.convertToSkeletonKey(
          placemarks,
          styles,
          timelineId,
          options,
        );

      console.log(
        "Conversion complete. Locations:",
        locations.length,
        "Shapes:",
        shapes.length,
      );

      return {
        success: true,
        data: { locations, shapes, styles, iconAnalysis },
        warnings,
      };
    } catch (error) {
      console.error("Import error:", error);
      return {
        success: false,
        error: `Failed to import KMZ: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  private static async processIconsFromUserFiles(
    customIconFiles: FileList,
  ): Promise<void> {
    console.log("Processing user-provided custom icons...");

    for (let i = 0; i < customIconFiles.length; i++) {
      const file = customIconFiles[i];
      try {
        const arrayBuffer = await file.arrayBuffer();
        const base64 = btoa(
          new Uint8Array(arrayBuffer).reduce(
            (data, byte) => data + String.fromCharCode(byte),
            "",
          ),
        );
        const dataUrl = `data:${file.type};base64,${base64}`;

        const fileName = file.name.toLowerCase();
        this.customIconCache.set(fileName, { url: dataUrl, name: file.name });
        this.customIconCache.set(fileName.replace(/\.[^/.]+$/, ""), {
          url: dataUrl,
          name: file.name,
        });

        console.log(`Cached custom icon: ${fileName}`);
      } catch (error) {
        console.warn(`Failed to process custom icon ${file.name}:`, error);
      }
    }
  }

  private static async processIconsFromKMZ(kmzFiles: JSZip): Promise<void> {
    const iconFiles = Object.keys(kmzFiles.files).filter(
      (name) =>
        /\.(png|jpg|jpeg|gif|svg|bmp|webp)$/i.test(name) &&
        !name.startsWith("__MACOSX"),
    );

    for (const iconPath of iconFiles) {
      try {
        const iconFile = kmzFiles.files[iconPath];
        if (iconFile && !iconFile.dir) {
          const arrayBuffer = await iconFile.async("arraybuffer");
          const base64 = btoa(
            new Uint8Array(arrayBuffer).reduce(
              (data, byte) => data + String.fromCharCode(byte),
              "",
            ),
          );

          const extension = iconPath.split(".").pop()?.toLowerCase();
          const mimeType = this.getMimeTypeFromExtension(extension || "png");
          const dataUrl = `data:${mimeType};base64,${base64}`;
          const originalName = iconPath.split("/").pop() || iconPath;

          this.customIconCache.set(iconPath, {
            url: dataUrl,
            name: originalName,
          });
          this.customIconCache.set(originalName.toLowerCase(), {
            url: dataUrl,
            name: originalName,
          });
          this.customIconCache.set(
            originalName.toLowerCase().replace(/\.[^/.]+$/, ""),
            { url: dataUrl, name: originalName },
          );

          console.log(`Extracted and cached icon from KMZ: ${iconPath}`);
        }
      } catch (error) {
        console.warn(`Failed to extract icon ${iconPath} from KMZ:`, error);
      }
    }

    console.log(`Total custom icons cached: ${this.customIconCache.size}`);
  }

  private static getMimeTypeFromExtension(extension: string): string {
    const mimeTypes: Record<string, string> = {
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      svg: "image/svg+xml",
      bmp: "image/bmp",
      webp: "image/webp",
    };
    return mimeTypes[extension] || "image/png";
  }

  private static extractStyles(kmlDoc: Document): KMLStyle[] {
    const styles: KMLStyle[] = [];

    const styleElements = kmlDoc.getElementsByTagName("Style");
    for (let i = 0; i < styleElements.length; i++) {
      const styleEl = styleElements[i];
      const id = styleEl.getAttribute("id");
      if (!id) continue;
      const style = this.parseStyleElement(styleEl, id);
      if (style) styles.push(style);
    }

    const cascadingStyles = kmlDoc.getElementsByTagName("gx:CascadingStyle");
    for (let i = 0; i < cascadingStyles.length; i++) {
      const cascadingEl = cascadingStyles[i];
      const id = cascadingEl.getAttribute("kml:id");
      if (!id) continue;
      const styleEl = cascadingEl.getElementsByTagName("Style")[0];
      if (styleEl) {
        const style = this.parseStyleElement(styleEl, id);
        if (style) styles.push(style);
      }
    }

    const styleMaps = kmlDoc.getElementsByTagName("StyleMap");
    for (let i = 0; i < styleMaps.length; i++) {
      const styleMapEl = styleMaps[i];
      const id = styleMapEl.getAttribute("id");
      if (!id) continue;

      const pairs = styleMapEl.getElementsByTagName("Pair");
      for (let j = 0; j < pairs.length; j++) {
        const pair = pairs[j];
        const key = pair.getElementsByTagName("key")[0]?.textContent;
        if (key === "normal") {
          const styleUrl = pair
            .getElementsByTagName("styleUrl")[0]
            ?.textContent?.replace("#", "");
          if (styleUrl) {
            const referencedStyle = styles.find((s) => s.id === styleUrl);
            if (referencedStyle) {
              styles.push({
                ...referencedStyle,
                id: id,
              });
            }
          }
          break;
        }
      }
    }

    console.log("Extracted styles:", styles.length);
    return styles;
  }

  private static parseStyleElement(
    styleEl: Element,
    id: string,
  ): KMLStyle | null {
    const style: KMLStyle = { id };

    const lineStyle = styleEl.getElementsByTagName("LineStyle")[0];
    if (lineStyle) {
      const color = lineStyle.getElementsByTagName("color")[0]?.textContent;
      const width = lineStyle.getElementsByTagName("width")[0]?.textContent;
      if (color) style.lineColor = this.kmlColorToHex(color);
      if (width) style.lineWidth = parseFloat(width);
    }

    const polyStyle = styleEl.getElementsByTagName("PolyStyle")[0];
    if (polyStyle) {
      const color = polyStyle.getElementsByTagName("color")[0]?.textContent;
      if (color) style.polyColor = this.kmlColorToHex(color);
    }

    const iconStyle = styleEl.getElementsByTagName("IconStyle")[0];
    if (iconStyle) {
      const icon = iconStyle.getElementsByTagName("Icon")[0];
      if (icon) {
        const href = icon.getElementsByTagName("href")[0]?.textContent;
        if (href) {
          style.iconHref = href;
          console.log("Found icon href:", href);
        }
      }

      const scale = iconStyle.getElementsByTagName("scale")[0]?.textContent;
      if (scale) {
        style.iconScale = parseFloat(scale);
      }

      const color = iconStyle.getElementsByTagName("color")[0]?.textContent;
      if (color) {
        style.iconColor = this.kmlColorToHex(color);
      }
    }

    return style;
  }

  private static extractPlacemarks(kmlDoc: Document): KMLPlacemark[] {
    const placemarks: KMLPlacemark[] = [];
    const placemarkElements = kmlDoc.getElementsByTagName("Placemark");

    for (let i = 0; i < placemarkElements.length; i++) {
      const placemark = placemarkElements[i];

      let name =
        placemark.getElementsByTagName("name")[0]?.textContent ||
        `Imported Feature ${i + 1}`;
      let description =
        placemark.getElementsByTagName("description")[0]?.innerHTML || "";

      const extendedData = this.extractExtendedData(placemark);

      if (name.startsWith("Imported Feature")) {
        const nameKeys = ["name", "Name", "NAME", "title", "Title", "TITLE"];
        const foundNameKey = nameKeys.find((key) => extendedData[key]);
        if (foundNameKey && extendedData[foundNameKey]) {
          name = extendedData[foundNameKey];
        }
      }

      if (!description.trim()) {
        const descKeys = ["description", "desc", "Description", "DESC"];
        const foundDescKey = descKeys.find((key) => extendedData[key]);
        if (foundDescKey && extendedData[foundDescKey]) {
          description = extendedData[foundDescKey];
        }
      }

      if (description) {
        description = description
          .replace(/<br\s*\/?>/gi, "\n")
          .replace(/<[^>]+>/g, "")
          .trim();
      }

      let styleUrl = placemark
        .getElementsByTagName("styleUrl")[0]
        ?.textContent?.replace("#", "");

      if (styleUrl) {
        const styleMap = kmlDoc.querySelector(`StyleMap[id="${styleUrl}"]`);
        if (styleMap) {
          const pairs = styleMap.getElementsByTagName("Pair");
          for (let j = 0; j < pairs.length; j++) {
            const key = pairs[j].getElementsByTagName("key")[0]?.textContent;
            if (key === "normal") {
              const normalStyleUrl = pairs[j]
                .getElementsByTagName("styleUrl")[0]
                ?.textContent?.replace("#", "");
              if (normalStyleUrl) {
                styleUrl = normalStyleUrl;
                break;
              }
            }
          }
        }
      }

      let iconHref: string | undefined;
      const inlineStyle = placemark.getElementsByTagName("Style")[0];
      if (inlineStyle) {
        const iconStyle = inlineStyle.getElementsByTagName("IconStyle")[0];
        if (iconStyle) {
          const icon = iconStyle.getElementsByTagName("Icon")[0];
          if (icon) {
            iconHref =
              icon.getElementsByTagName("href")[0]?.textContent || undefined;
          }
        }
      }

      const geometry = this.extractGeometry(placemark);
      if (geometry) {
        placemarks.push({
          name,
          description,
          styleUrl,
          iconHref,
          extendedData: extendedData,
          ...geometry,
        });
      }
    }

    return placemarks;
  }

  private static extractExtendedData(
    placemark: Element,
  ): Record<string, string> {
    const extendedData: Record<string, string> = {};

    const extendedDataEl = placemark.getElementsByTagName("ExtendedData")[0];
    if (extendedDataEl) {
      const dataElements = extendedDataEl.getElementsByTagName("Data");
      for (let i = 0; i < dataElements.length; i++) {
        const dataEl = dataElements[i];
        const name = dataEl.getAttribute("name");
        const value = dataEl.getElementsByTagName("value")[0]?.textContent;
        if (name && value) {
          extendedData[name] = value;
        }
      }
    }

    return extendedData;
  }

  private static extractGeometry(
    placemark: Element,
  ): { coordinates: Coordinates[]; type: KMLPlacemark["type"] } | null {
    const point = placemark.getElementsByTagName("Point")[0];
    if (point) {
      const coords = this.parseCoordinates(
        point.getElementsByTagName("coordinates")[0]?.textContent || "",
      );
      return { coordinates: coords, type: "Point" };
    }

    const lineString = placemark.getElementsByTagName("LineString")[0];
    if (lineString) {
      const coords = this.parseCoordinates(
        lineString.getElementsByTagName("coordinates")[0]?.textContent || "",
      );
      return { coordinates: coords, type: "LineString" };
    }

    const polygon = placemark.getElementsByTagName("Polygon")[0];
    if (polygon) {
      const outerBoundary = polygon.getElementsByTagName("outerBoundaryIs")[0];
      if (outerBoundary) {
        const linearRing = outerBoundary.getElementsByTagName("LinearRing")[0];
        if (linearRing) {
          const coords = this.parseCoordinates(
            linearRing.getElementsByTagName("coordinates")[0]?.textContent ||
              "",
          );
          return { coordinates: coords, type: "Polygon" };
        }
      }
    }

    return null;
  }

  private static parseCoordinates(coordsString: string): Coordinates[] {
    const coordinates: Coordinates[] = [];
    if (!coordsString) return coordinates;

    const cleanCoords = coordsString
      .trim()
      .replace(/\s+/g, " ")
      .replace(/\n/g, " ");
    const coordPairs = cleanCoords.split(/\s+/);

    for (const pair of coordPairs) {
      if (!pair.trim()) continue;
      const parts = pair.split(",");
      if (parts.length >= 2) {
        const lng = parseFloat(parts[0].trim());
        const lat = parseFloat(parts[1].trim());
        if (!isNaN(lng) && !isNaN(lat)) {
          coordinates.push({ lat, lng });
        }
      }
    }

    return coordinates;
  }

  private static kmlColorToHex(kmlColor: string): string {
    if (kmlColor.length === 8) {
      const r = kmlColor.slice(6, 8);
      const g = kmlColor.slice(4, 6);
      const b = kmlColor.slice(2, 4);
      return `#${r}${g}${b}`;
    }
    return "#3388ff";
  }

  private static async convertToSkeletonKey(
    placemarks: KMLPlacemark[],
    styles: KMLStyle[],
    timelineId?: string,
    options: ImportOptions = {},
  ): Promise<{
    locations: LocationType[];
    shapes: AnchoredShape[];
    warnings: string[];
    iconAnalysis: {
      totalIcons: number;
      standardIcons: number;
      customIcons: number;
      mappings: Record<string, string>;
    };
  }> {
    const locations: LocationType[] = [];
    const shapes: AnchoredShape[] = [];
    const warnings: string[] = [];
    const iconMappings: Record<string, string> = {};

    let totalIcons = 0;
    let standardIcons = 0;
    let customIcons = 0;

    for (const placemark of placemarks) {
      try {
        if (placemark.type === "Point" && placemark.coordinates.length > 0) {
          let originalIconUrl: string | undefined;

          if (placemark.iconHref) {
            originalIconUrl = placemark.iconHref;
          } else if (placemark.styleUrl) {
            const style = styles.find((s) => s.id === placemark.styleUrl);
            if (style?.iconHref) originalIconUrl = style.iconHref;
          }

          const locationProperties: LocationType["properties"] = {
            ...placemark.extendedData,
          };

          if (originalIconUrl) {
            totalIcons++;
            const iconKey =
              originalIconUrl.split("/").pop()?.toLowerCase() ||
              originalIconUrl;
            const cachedIcon =
              this.customIconCache.get(originalIconUrl) ||
              this.customIconCache.get(iconKey) ||
              this.customIconCache.get(iconKey.replace(/\.[^/.]+$/, ""));

            if (cachedIcon) {
              customIcons++;
              locationProperties.customIcon = {
                url: cachedIcon.url,
                name: cachedIcon.name,
              };
              console.log(
                `Mapped custom icon for ${placemark.name}: ${cachedIcon.name}`,
              );
            } else {
              standardIcons++;
              const mappedIconId = getIconFromGoogleEarthUrl(originalIconUrl);
              locationProperties.importedIconId = mappedIconId;
              iconMappings[originalIconUrl] = mappedIconId;
            }
            locationProperties.originalIconUrl = originalIconUrl;
          }

          const location: LocationType = {
            id: `imported_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: placemark.name || "Imported Location",
            description: placemark.description || "",
            coordinates: placemark.coordinates[0],
            timelineIds: timelineId ? [timelineId] : [],
            tags: ["imported", "kml"],
            properties: locationProperties,
            parentLocationId: null,
            linkedEventIds: [],
            foundedDate: null,
            destroyedDate: null,
            population: null,
            importance: 5,
            type: "Point of Interest",
            notes: "",
            mapUrl: null,
          };

          if (options.createLocationsForPoints || options.analyzeOnly) {
            locations.push(location);
          }
        } else if (placemark.coordinates.length > 0) {
          const shapeType =
            placemark.type === "Polygon" ? "polygon" : "polyline";
          const style = placemark.styleUrl
            ? styles.find((s) => s.id === placemark.styleUrl)
            : undefined;

          const shape: AnchoredShape = {
            id: `imported_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: shapeType,
            anchor: {
              locationId: "origin",
              offsetLat: 0,
              offsetLng: 0,
              anchorType: "center",
            },
            geometry: {
              points: placemark.coordinates.map((coord) => ({
                lat: coord.lat,
                lng: coord.lng,
              })),
            },
            style: {
              color: style?.lineColor || "#3388ff",
              fillColor: style?.polyColor || "#3388ff",
              opacity: 1,
              fillOpacity: 0.3,
              strokeWidth: style?.lineWidth || 2,
            },
            properties: {
              name: placemark.name || "Imported Shape",
              description: placemark.description || "",
              category: "custom",
              timelineId: timelineId,
              dateCreated: new Date().toISOString(),
              ...placemark.extendedData,
            },
          };
          shapes.push(shape);
        }
      } catch (error) {
        const errorMsg = `Failed to convert ${placemark.name}: ${error instanceof Error ? error.message : "Unknown error"}`;
        warnings.push(errorMsg);
      }
    }

    const iconAnalysis = {
      totalIcons,
      standardIcons,
      customIcons,
      mappings: iconMappings,
    };

    return { locations, shapes, warnings, iconAnalysis };
  }
}

export const useKMZImport = () => {
  const importKMZ = async (
    file: File,
    timelineId?: string,
    options?: ImportOptions,
  ): Promise<ImportResult> => {
    return EnhancedKMZImportService.importKMZ(file, timelineId, options);
  };

  return { importKMZ };
};

export { EnhancedKMZImportService as KMZImportService };
