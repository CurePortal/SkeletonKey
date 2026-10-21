// src/utils/mapIcons.ts - Corrected & Resized
import L from "leaflet";
import { renderToString } from "react-dom/server";
import React from "react";

// Import react-icons
import {
  // Material Design Icons
  MdLocationOn,
  MdHome,
  MdBusiness,
  MdSchool,
  MdLocalHospital,
  MdRestaurant,
  MdLocalCafe,
  MdLocalGasStation,
  MdLocalParking,
  MdAirplanemodeActive,
  MdTrain,
  MdDirectionsBus,
  MdLocalPharmacy,
  MdLocalLibrary,
  MdLocalMovies,
  MdLocalAtm,
  MdShoppingCart,
  MdGolfCourse,
  MdPool,
  MdLocalPostOffice,
  MdMuseum,
  MdChurch,
  MdPark,
  MdTerrain,
  MdBeachAccess,
  MdLocalBar,
  MdHotel,
  MdTheaters,
} from "react-icons/md";

import {
  // Font Awesome Icons for additional coverage
  FaMapMarkerAlt,
  FaUniversity,
  FaDollarSign,
  FaCampground,
  FaPizzaSlice,
  FaHamburger,
  FaDumbbell,
} from "react-icons/fa";

// Icon definition interface
export interface MapIcon {
  id: string;
  name: string;
  category: string;
  icon: React.ComponentType<any>;
  color?: string;
  size?: [number, number];
  anchor?: [number, number];
}

// Comprehensive icon library using react-icons
export const MAP_ICONS: MapIcon[] = [
  // === PUSHPINS / GENERIC LOCATIONS ===
  {
    id: "pin-yellow",
    name: "Yellow Pin",
    category: "pushpins",
    icon: MdLocationOn,
    color: "#FFEB3B",
  },
  {
    id: "pin-red",
    name: "Red Pin",
    category: "pushpins",
    icon: MdLocationOn,
    color: "#F44336",
  },
  {
    id: "pin-blue",
    name: "Blue Pin",
    category: "pushpins",
    icon: MdLocationOn,
    color: "#2196F3",
  },
  {
    id: "pin-green",
    name: "Green Pin",
    category: "pushpins",
    icon: MdLocationOn,
    color: "#4CAF50",
  },
  {
    id: "pin-purple",
    name: "Purple Pin",
    category: "pushpins",
    icon: MdLocationOn,
    color: "#9C27B0",
  },
  {
    id: "pin-orange",
    name: "Orange Pin",
    category: "pushpins",
    icon: MdLocationOn,
    color: "#FF9800",
  },
  {
    id: "pin-pink",
    name: "Pink Pin",
    category: "pushpins",
    icon: MdLocationOn,
    color: "#E91E63",
  },
  {
    id: "pin-white",
    name: "White Pin",
    category: "pushpins",
    icon: MdLocationOn,
    color: "#FFFFFF",
  },
  {
    id: "pin-lightblue",
    name: "Light Blue Pin",
    category: "pushpins",
    icon: MdLocationOn,
    color: "#03A9F4",
  },
  {
    id: "place-generic",
    name: "Generic Place",
    category: "places",
    icon: FaMapMarkerAlt,
    color: "#4285F4",
  },

  // === ACCOMMODATION ===
  {
    id: "lodging",
    name: "Hotel/Lodging",
    category: "accommodation",
    icon: MdHotel,
    color: "#4CAF50",
  },
  {
    id: "camping",
    name: "Camping",
    category: "accommodation",
    icon: FaCampground,
    color: "#8BC34A",
  },

  // === DINING ===
  {
    id: "restaurant",
    name: "Restaurant",
    category: "dining",
    icon: MdRestaurant,
    color: "#FF5722",
  },
  {
    id: "bar",
    name: "Bar",
    category: "dining",
    icon: MdLocalBar,
    color: "#795548",
  },
  {
    id: "coffee",
    name: "Coffee Shop",
    category: "dining",
    icon: MdLocalCafe,
    color: "#8D6E63",
  },
  {
    id: "pizza",
    name: "Pizza",
    category: "dining",
    icon: FaPizzaSlice,
    color: "#FF6B35",
  },
  {
    id: "fastfood",
    name: "Fast Food",
    category: "dining",
    icon: FaHamburger,
    color: "#FF9800",
  },

  // === TRANSPORTATION ===
  {
    id: "airports",
    name: "Airport",
    category: "transportation",
    icon: MdAirplanemodeActive,
    color: "#607D8B",
  },
  {
    id: "gas-station",
    name: "Gas Station",
    category: "transportation",
    icon: MdLocalGasStation,
    color: "#FFC107",
  },
  {
    id: "parking",
    name: "Parking",
    category: "transportation",
    icon: MdLocalParking,
    color: "#2196F3",
  },
  {
    id: "train-station",
    name: "Train Station",
    category: "transportation",
    icon: MdTrain,
    color: "#795548",
  },
  {
    id: "bus-station",
    name: "Bus Station",
    category: "transportation",
    icon: MdDirectionsBus,
    color: "#9E9E9E",
  },

  // === EDUCATION ===
  {
    id: "schools",
    name: "School",
    category: "education",
    icon: MdSchool,
    color: "#FF9800",
  },
  {
    id: "university",
    name: "University",
    category: "education",
    icon: FaUniversity,
    color: "#3F51B5",
  },
  {
    id: "library",
    name: "Library",
    category: "education",
    icon: MdLocalLibrary,
    color: "#9C27B0",
  },

  // === MEDICAL ===
  {
    id: "hospitals",
    name: "Hospital",
    category: "medical",
    icon: MdLocalHospital,
    color: "#F44336",
  },
  {
    id: "pharmacy",
    name: "Pharmacy",
    category: "medical",
    icon: MdLocalPharmacy,
    color: "#4CAF50",
  },

  // === SHOPPING & SERVICES ===
  {
    id: "shopping",
    name: "Shopping",
    category: "shopping",
    icon: MdShoppingCart,
    color: "#E91E63",
  },
  {
    id: "bank",
    name: "Bank",
    category: "shopping",
    icon: FaDollarSign,
    color: "#4CAF50",
  },
  {
    id: "atm",
    name: "ATM",
    category: "services",
    icon: MdLocalAtm,
    color: "#4CAF50",
  },
  {
    id: "post-office",
    name: "Post Office",
    category: "services",
    icon: MdLocalPostOffice,
    color: "#2196F3",
  },

  // === ENTERTAINMENT ===
  {
    id: "movies",
    name: "Movie Theater",
    category: "entertainment",
    icon: MdLocalMovies,
    color: "#9C27B0",
  },
  {
    id: "tourist",
    name: "Tourist Attraction",
    category: "entertainment",
    icon: MdMuseum,
    color: "#FF9800",
  },
  {
    id: "theater",
    name: "Theater",
    category: "entertainment",
    icon: MdTheaters,
    color: "#E91E63",
  },

  // === SPORTS & RECREATION ===
  {
    id: "golf",
    name: "Golf Course",
    category: "sports",
    icon: MdGolfCourse,
    color: "#4CAF50",
  },
  {
    id: "swimming",
    name: "Swimming Pool",
    category: "sports",
    icon: MdPool,
    color: "#03A9F4",
  },
  {
    id: "fitness",
    name: "Gym/Fitness",
    category: "sports",
    icon: FaDumbbell,
    color: "#FF5722",
  },

  // === PLACES OF WORSHIP ===
  {
    id: "church",
    name: "Church",
    category: "worship",
    icon: MdChurch,
    color: "#795548",
  },

  // === NATURE & OUTDOORS ===
  {
    id: "park",
    name: "Park",
    category: "nature",
    icon: MdPark,
    color: "#4CAF50",
  },
  {
    id: "mountain",
    name: "Mountain",
    category: "nature",
    icon: MdTerrain,
    color: "#795548",
  },
  {
    id: "beach",
    name: "Beach",
    category: "nature",
    icon: MdBeachAccess,
    color: "#03A9F4",
  },

  // === RESIDENTIAL ===
  {
    id: "home",
    name: "Home",
    category: "residential",
    icon: MdHome,
    color: "#4CAF50",
  },
  {
    id: "building",
    name: "Building",
    category: "residential",
    icon: MdBusiness,
    color: "#9E9E9E",
  },

  // === PLACES (FALLBACK) ===
  {
    id: "places",
    name: "Places",
    category: "places",
    icon: FaMapMarkerAlt,
    color: "#4285F4",
  },
];

// COMPREHENSIVE Google Earth icon URL to local icon mapping
export const GOOGLE_EARTH_ICON_MAPPING: Record<string, string> = {
  // === PUSHPIN MAPPINGS ===
  "http://maps.google.com/mapfiles/kml/pushpin/ylw-pushpin.png": "pin-yellow",
  "http://maps.google.com/mapfiles/kml/pushpin/red-pushpin.png": "pin-red",
  "http://maps.google.com/mapfiles/kml/pushpin/blue-pushpin.png": "pin-blue",
  "http://maps.google.com/mapfiles/kml/pushpin/grn-pushpin.png": "pin-green",
  "http://maps.google.com/mapfiles/kml/pushpin/ltblu-pushpin.png":
    "pin-lightblue",
  "http://maps.google.com/mapfiles/kml/pushpin/pink-pushpin.png": "pin-pink",
  "http://maps.google.com/mapfiles/kml/pushpin/purple-pushpin.png":
    "pin-purple",
  "http://maps.google.com/mapfiles/kml/pushpin/wht-pushpin.png": "pin-white",

  // === PAL2 ICON MAPPINGS ===
  "http://maps.google.com/mapfiles/kml/pal2/icon0.png": "pin-white",
  "http://maps.google.com/mapfiles/kml/pal2/icon1.png": "pin-red",
  "http://maps.google.com/mapfiles/kml/pal2/icon2.png": "pin-green",
  "http://maps.google.com/mapfiles/kml/pal2/icon3.png": "pin-blue",
  "http://maps.google.com/mapfiles/kml/pal2/icon4.png": "pin-yellow",
  "http://maps.google.com/mapfiles/kml/pal2/icon5.png": "pin-orange",
  "http://maps.google.com/mapfiles/kml/pal2/icon6.png": "pin-purple",
  "http://maps.google.com/mapfiles/kml/pal2/icon7.png": "pin-pink",
  "http://maps.google.com/mapfiles/kml/pal2/icon10.png": "lodging",
  "http://maps.google.com/mapfiles/kml/pal2/icon12.png": "camping",
  "http://maps.google.com/mapfiles/kml/pal2/icon13.png": "restaurant",
  "http://maps.google.com/mapfiles/kml/pal2/icon15.png": "bar",
  "http://maps.google.com/mapfiles/kml/pal2/icon16.png": "coffee",
  "http://maps.google.com/mapfiles/kml/pal2/icon18.png": "places",
  "http://maps.google.com/mapfiles/kml/pal2/icon20.png": "airports",
  "http://maps.google.com/mapfiles/kml/pal2/icon25.png": "gas-station",
  "http://maps.google.com/mapfiles/kml/pal2/icon27.png": "parking",

  // === PAL3 ICON MAPPINGS ===
  "http://maps.google.com/mapfiles/kml/pal3/icon0.png": "pin-white",
  "http://maps.google.com/mapfiles/kml/pal3/icon20.png": "hospitals",
  "http://maps.google.com/mapfiles/kml/pal3/icon21.png": "pharmacy",
  "http://maps.google.com/mapfiles/kml/pal3/icon23.png": "schools",
  "http://maps.google.com/mapfiles/kml/pal3/icon27.png": "library",
  "http://maps.google.com/mapfiles/kml/pal3/icon35.png": "schools",

  // === PAL4 ICON MAPPINGS ===
  "http://maps.google.com/mapfiles/kml/pal4/icon15.png": "shopping",
  "http://maps.google.com/mapfiles/kml/pal4/icon46.png": "movies",
  "http://maps.google.com/mapfiles/kml/pal4/icon49.png": "tourist",
  "http://maps.google.com/mapfiles/kml/pal4/icon54.png": "train-station",
  "http://maps.google.com/mapfiles/kml/pal4/icon57.png": "golf",

  // === PAL5 ICON MAPPINGS ===
  "http://maps.google.com/mapfiles/kml/pal5/icon0.png": "atm",
  "http://maps.google.com/mapfiles/kml/pal5/icon17.png": "bank",
  "http://maps.google.com/mapfiles/kml/pal5/icon25.png": "post-office",

  // === SHAPES MAPPINGS ===
  "http://maps.google.com/mapfiles/kml/shapes/target.png": "pin-red",
  "http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png": "pin-blue",
  "http://maps.google.com/mapfiles/kml/shapes/placemark_square.png": "places",

  // ========================= FIX START =========================
  // Added missing icon mapping for #44
  "http://maps.google.com/mapfiles/kml/shapes/firedept.png": "building",
  // ========================== FIX END ==========================

  // === DEFAULT FALLBACK ===
  default: "place-generic",
};

// ========================= ICON SIZE FIX START =========================
// This function has been updated to generate smaller 24x24 icons instead of 32x32.
export function createLeafletIcon(
  iconId: string,
  customColor?: string,
): L.Icon {
  const iconData = MAP_ICONS.find((icon) => icon.id === iconId);

  if (!iconData) {
    console.warn(`Icon not found: ${iconId}. Using fallback.`);
    return createLeafletIcon("place-generic", customColor);
  }

  const color = customColor || iconData.color || "#4285F4";
  const IconComponent = iconData.icon;

  try {
    // Render React icon to SVG string (inner icon)
    const iconElement = React.createElement(IconComponent, {
      size: 16, // The icon inside the circle
      color: color,
      style: { display: "block" },
    });

    const svgString = renderToString(iconElement);

    // Create a complete SVG wrapper for the icon
    const svgContent = `
      <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="11" fill="white" stroke="${color}" stroke-width="2"/>
        <g transform="translate(4, 4)">
          ${svgString.replace(/<svg[^>]*>|<\/svg>/g, "")}
        </g>
      </svg>
    `
      .replace(/\s+/g, " ")
      .trim();

    // Use base64 encoding for better compatibility
    const dataUrl = `data:image/svg+xml;base64,${btoa(svgContent)}`;

    return L.icon({
      iconUrl: dataUrl,
      iconSize: iconData.size || [24, 24], // Set final map icon size to 24x24
      iconAnchor: iconData.anchor || [12, 24], // Anchor at bottom-center
      popupAnchor: [0, -24], // Popup above the icon
      shadowUrl: undefined,
      className: `custom-icon icon-${iconId}`,
    });
  } catch (error) {
    console.error(`Failed to create icon for ${iconId}:`, error);
    // Fallback to a simple colored circle
    return createSimpleFallbackIcon(color);
  }
}

// Simple fallback icon when React icon rendering fails
function createSimpleFallbackIcon(color: string): L.Icon {
  const svgContent = `
    <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" fill="${color}" stroke="white" stroke-width="2"/>
      <circle cx="12" cy="12" r="3" fill="white"/>
    </svg>
  `
    .replace(/\s+/g, " ")
    .trim();

  const dataUrl = `data:image/svg+xml;base64,${btoa(svgContent)}`;

  return L.icon({
    iconUrl: dataUrl,
    iconSize: [24, 24],
    iconAnchor: [12, 24],
    popupAnchor: [0, -24],
    shadowUrl: undefined,
    className: "custom-icon fallback-icon",
  });
}
// ========================== ICON SIZE FIX END ==========================

// Enhanced icon mapping with pattern matching
export function getIconFromGoogleEarthUrl(iconUrl?: string): string {
  if (!iconUrl) return "place-generic";

  console.log(`Mapping icon URL: ${iconUrl}`);

  // Direct mapping first
  if (GOOGLE_EARTH_ICON_MAPPING[iconUrl]) {
    const mappedIcon = GOOGLE_EARTH_ICON_MAPPING[iconUrl];
    console.log(`Direct mapping: ${iconUrl} -> ${mappedIcon}`);
    return mappedIcon;
  }

  // Pattern matching for pushpins
  if (iconUrl.includes("pushpin")) {
    if (iconUrl.includes("ylw")) return "pin-yellow";
    if (iconUrl.includes("red")) return "pin-red";
    if (iconUrl.includes("blue") || iconUrl.includes("ltblu"))
      return "pin-blue";
    if (iconUrl.includes("grn")) return "pin-green";
    if (iconUrl.includes("pink")) return "pin-pink";
    if (iconUrl.includes("purple")) return "pin-purple";
    if (iconUrl.includes("wht")) return "pin-white";
    return "pin-blue"; // Default pushpin
  }

  // Pattern matching for numbered icons
  const palMatch = iconUrl.match(/pal(\d+)\/icon(\d+)\.png/);
  if (palMatch) {
    const palette = palMatch[1];
    const iconNum = palMatch[2];
    const key = `http://maps.google.com/mapfiles/kml/pal${palette}/icon${iconNum}.png`;
    if (GOOGLE_EARTH_ICON_MAPPING[key]) {
      console.log(
        `Palette mapping: ${key} -> ${GOOGLE_EARTH_ICON_MAPPING[key]}`,
      );
      return GOOGLE_EARTH_ICON_MAPPING[key];
    }
  }

  // Content-based pattern matching
  const contentMappings = {
    hospital: "hospitals",
    medical: "hospitals",
    health: "hospitals",
    school: "schools",
    education: "schools",
    university: "university",
    restaurant: "restaurant",
    dining: "restaurant",
    food: "restaurant",
    hotel: "lodging",
    lodging: "lodging",
    accommodation: "lodging",
    airport: "airports",
    plane: "airports",
    gas: "gas-station",
    fuel: "gas-station",
    parking: "parking",
    train: "train-station",
    rail: "train-station",
    coffee: "coffee",
    cafe: "coffee",
    bank: "bank",
    atm: "atm",
    shopping: "shopping",
    store: "shopping",
    movie: "movies",
    cinema: "movies",
    theater: "theater",
    golf: "golf",
    swimming: "swimming",
    pool: "swimming",
    post: "post-office",
    mail: "post-office",
    tourist: "tourist",
    attraction: "tourist",
    church: "church",
    worship: "church",
    park: "park",
    mountain: "mountain",
    beach: "beach",
    home: "home",
    house: "home",
    building: "building",
    fitness: "fitness",
    gym: "fitness",
  };

  const lowerUrl = iconUrl.toLowerCase();
  for (const [keyword, iconId] of Object.entries(contentMappings)) {
    if (lowerUrl.includes(keyword)) {
      console.log(`Content mapping: ${keyword} -> ${iconId}`);
      return iconId;
    }
  }

  console.log(`No mapping found for: ${iconUrl}, using fallback`);
  return "place-generic";
}

// Get icons by category for UI
export function getIconsByCategory(): Record<string, MapIcon[]> {
  return MAP_ICONS.reduce(
    (acc, icon) => {
      if (!acc[icon.category]) acc[icon.category] = [];
      acc[icon.category].push(icon);
      return acc;
    },
    {} as Record<string, MapIcon[]>,
  );
}
