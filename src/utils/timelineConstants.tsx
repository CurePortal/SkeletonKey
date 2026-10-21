// src/utils/timelineConstants.tsx

import React from "react";
import { EventIconId } from "../types";

type IconElementType = React.JSX.Element;

interface IconDetail {
  icon: IconElementType;
  name: string;
}

export const eventIcons: Record<EventIconId, IconDetail> = {
  default: {
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13.25a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V4.75z"
          clipRule="evenodd"
        />
      </svg>
    ),
    name: "Default Event",
  },
  warning: {
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        className="text-yellow-500"
      >
        <path
          fillRule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
          clipRule="evenodd"
        />
      </svg>
    ),
    name: "Warning",
  },
  milestone: {
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        className="text-green-500"
      >
        <path
          fillRule="evenodd"
          d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.39-3.468 3.386a.75.75 0 00.536 1.266l5.078.734 2.277 4.908c.32.771 1.414.771 1.735 0l2.276-4.908 5.079-.734a.75.75 0 00.535-1.266l-3.468-3.386-4.753-.39-1.83-4.401z"
          clipRule="evenodd"
        />
      </svg>
    ),
    name: "Milestone",
  },
  star: {
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        className="text-blue-500"
      >
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>
    ),
    name: "Star Event",
  },

  crown: {
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor">
        <path d="M10 2a2 2 0 00-2 2v1H4a1 1 0 000 2h1v5a2 2 0 002 2h6a2 2 0 002-2V7h1a1 1 0 100-2h-4V4a2 2 0 00-2-2zm-3 9V7h6v4H7z" />
      </svg>
    ),
    name: "Crown",
  },
  flag: {
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor">
        <path d="M3 3a1 1 0 00-1 1v12a1 1 0 001 1h12a1 1 0 001-1V9l-4-4H3zm2 2h3v2H5V5zm0 4h3v2H5V9zm5 0h3v2h-3V9z" />
      </svg>
    ),
    name: "Flag",
  },
  bolt: {
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor">
        <path
          fillRule="evenodd"
          d="M11.3 2.25a.75.75 0 00-1.086.649l-.834 5.835H6.75a.75.75 0 00-.73.996l2.004 6.01A.75.75 0 008.75 16h2.5a.75.75 0 00.73-.504l2.003-6.01a.75.75 0 00-.73-.996h-2.63l.834-5.835a.75.75 0 00-.552-.735z"
          clipRule="evenodd"
        />
      </svg>
    ),
    name: "Bolt",
  },
  globe: {
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor">
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zM4.136 7.042a6.5 6.5 0 017.728 0l-3.864 3.864-3.864-3.864zM14.33 9.028a6.502 6.502 0 01-1.334 4.406L10 10.398l4.33-1.37zm-9.994.084L10 10.398 5.67 13.434A6.502 6.502 0 014.336 9.112zM10 16.5a6.5 6.5 0 005.293-10.042L10 11.752l-5.293-5.294A6.5 6.5 0 0010 16.5z"
          clipRule="evenodd"
        />
      </svg>
    ),
    name: "Globe",
  },
  building: {
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor">
        <path
          fillRule="evenodd"
          d="M4 2a1 1 0 00-1 1v14a1 1 0 001 1h12a1 1 0 001-1V3a1 1 0 00-1-1H4zm2 2h2v2H6V4zm0 4h2v2H6V8zm0 4h2v2H6v-2zm4-8h2v2h-2V4zm0 4h2v2h-2V8zm0 4h2v2h-2v-2zm4-8h2v2h-2V4zm0 4h2v2h-2V8z"
          clipRule="evenodd"
        />
      </svg>
    ),
    name: "Building",
  },
  book: {
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor">
        <path
          fillRule="evenodd"
          d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 01.75.75v9.5a.75.75 0 01-.75.75H2.75a.75.75 0 01-.75-.75v-9.5zm3.25 0v9.5H17V4.75H5.25zM3.5 5.5v7.5h1V5.5h-1z"
          clipRule="evenodd"
        />
      </svg>
    ),
    name: "Book",
  },
  users: {
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor">
        <path d="M7 8a3 3 0 100-6 3 3 0 000 6zm0 1.5c-2.166 0-4.163.834-5.657 2.327A.75.75 0 002.09 13.5h9.82a.75.75 0 00.748-1.673C11.163 10.334 9.166 9.5 7 9.5zm7.75 1.193a.75.75 0 00-1.06-1.06L12.5 10.828V9.75a.75.75 0 00-1.5 0v1.75a.75.75 0 00.75.75h1.75a.75.75 0 000-1.5h-1.086l1.182-1.182zM13 3.5a2 2 0 100-4 2 2 0 000 4z" />
      </svg>
    ),
    name: "Users",
  },
  zap: {
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor">
        <path d="M11.903 3.347a.75.75 0 00-1.26-.768L6.303 9.25H3.75a.75.75 0 000 1.5h3.113l-2.28 4.56A.75.75 0 005.25 16h9.5a.75.75 0 00.703-1.035l-4.163-7.643a.75.75 0 00-.387-.322L11.903 3.347z" />
      </svg>
    ),
    name: "Zap",
  },
  award: {
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor">
        <path
          fillRule="evenodd"
          d="M10 2a.75.75 0 01.75.75v2.519c.46.092.903.238 1.318.432l2.036-.936a.75.75 0 01.935.405l1.25 2.5a.75.75 0 01-.237.96l-1.743 1.26c.098.403.15.82.15 1.25s-.052.847-.15 1.25l1.743 1.26a.75.75 0 01.237.96l-1.25 2.5a.75.75 0 01-.935.405l-2.036-.936a5.227 5.227 0 01-1.318.432v2.519a.75.75 0 01-1.5 0v-2.519a5.227 5.227 0 01-1.318-.432l-2.036.936a.75.75 0 01-.935-.405l-1.25-2.5a.75.75 0 01.237-.96l1.743-1.26a5.01 5.01 0 01-.15-.25V10c0-.43.052-.847.15-1.25L2.237 7.49a.75.75 0 01-.237-.96l1.25-2.5a.75.75 0 01.935-.405l2.036.936A5.227 5.227 0 017.5 5.269V2.75A.75.75 0 0110 2zm-1.25 6.17a2.5 2.5 0 100 3.66 2.5 2.5 0 000-3.66z"
          clipRule="evenodd"
        />
      </svg>
    ),
    name: "Award",
  },
  anchor: {
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor">
        <path
          fillRule="evenodd"
          d="M10 2a.75.75 0 01.75.75v1.168A3.004 3.004 0 0113 6.5a3 3 0 01-3 3 .75.75 0 010-1.5A1.5 1.5 0 108.5 6.5a.75.75 0 01-1.5 0A2.5 2.5 0 019.5 4V2.75A.75.75 0 0110 2zm0 12.5a.75.75 0 01.75.75v2.25h.75a.75.75 0 010 1.5h-3a.75.75 0 010-1.5h.75V15.25a.75.75 0 01.75-.75zm-3.75-4a.75.75 0 000 1.5h7.5a.75.75 0 000-1.5h-7.5z"
          clipRule="evenodd"
        />
      </svg>
    ),
    name: "Anchor",
  },
  crosshair: {
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor">
        <path d="M10 3.5A6.5 6.5 0 003.5 10H2a.75.75 0 000 1.5h1.5A6.5 6.5 0 0010 18a6.5 6.5 0 006.5-6.5H18a.75.75 0 000-1.5h-1.5A6.5 6.5 0 0010 3.5zM10 5a5 5 0 100 10 5 5 0 000-10zm0 .75a.75.75 0 01.75.75v2.75h2.75a.75.75 0 010 1.5H10.75v2.75a.75.75 0 01-1.5 0V10.75H6.5a.75.75 0 010-1.5h2.75V6.5a.75.75 0 01.75-.75z" />
      </svg>
    ),
    name: "Crosshair",
  },
  briefcase: {
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor">
        <path
          fillRule="evenodd"
          d="M2 4.75A.75.75 0 012.75 4h14.5a.75.75 0 01.75.75V7.5h-16V4.75zM18 9.5v6.75a.75.75 0 01-.75.75H2.75a.75.75 0 01-.75-.75V9.5h16zm-9.25-1A.75.75 0 008 9.25v.5H5.75a.75.75 0 000 1.5h2.25V12H5.75a.75.75 0 000 1.5h2.25v.5a.75.75 0 001.5 0v-.5h2.25a.75.75 0 000-1.5H10.25V12h2.25a.75.75 0 000-1.5H10.25v-.5a.75.75 0 00-.75-.75h-.5z"
          clipRule="evenodd"
        />
      </svg>
    ),
    name: "Briefcase",
  },
  map: {
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor">
        <path
          fillRule="evenodd"
          d="M11.09 2.147a.75.75 0 00-1.033.107L2.267 9.94a.75.75 0 00.584 1.21l3.988-.664 3.451 3.452a.75.75 0 001.06 0l3.452-3.451 4.186.697a.75.75 0 00.907-.978L11.09 2.147zm.923 9.297l-3.451 3.452-2.386-2.387 3.451-3.451 2.386 2.386z"
          clipRule="evenodd"
        />
      </svg>
    ),
    name: "Map",
  },
};

// Constants for the timeline editor
export const EVENT_NODE_WIDTH = 250;
export const HORIZONTAL_SPACING_EVENT = 0;
export const TIMELINE_VERTICAL_SPACING = 150;
export const TIMELINE_INITIAL_Y = 100;
export const TIMELINE_INITIAL_X = 50;
