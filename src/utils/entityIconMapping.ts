import React from "react";
import {
  FiClock,
  FiUsers,
  FiMapPin,
  FiCpu,
  FiGlobe,
  FiFileText,
  FiBookOpen,
  FiGitMerge,
  FiAlertCircle,
} from "react-icons/fi";
import { SearchResult } from "../types/search"; //

export const entityIconMapping: Record<
  SearchResult["type"],
  React.ElementType
> = {
  //
  event: FiClock,
  character: FiUsers,
  location: FiMapPin,
  technology: FiCpu,
  culture: FiGlobe,
  sourceDocument: FiFileText,
  narrative: FiBookOpen,
  timeline: FiGitMerge,
};

export const defaultEntityIcon = FiAlertCircle;
