use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    #[serde(rename = "updatedAt")]
    pub updated_at: String,
    pub timelines: Vec<Timeline>,
    pub characters: Vec<Character>,
    pub locations: Vec<Location>,
    pub technologies: Vec<Technology>,
    pub cultures: Vec<Culture>,
    #[serde(rename = "sourceDocuments")]
    pub source_documents: Vec<SourceDocument>,
    pub narratives: Vec<Narrative>,
    pub version: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Timeline {
    pub id: String,
    pub name: String,
    pub description: String,
    pub events: Vec<Event>,
    #[serde(rename = "pointsOfDivergence")]
    pub points_of_divergence: Vec<PointOfDivergence>,
    #[serde(rename = "startDate")]
    pub start_date: String,
    #[serde(rename = "endDate")]
    pub end_date: String,
    #[serde(rename = "isMainTimeline")]
    pub is_main_timeline: bool,
    #[serde(rename = "parentTimelineId")]
    pub parent_timeline_id: Option<String>,
    #[serde(rename = "branchFromEventId")]
    pub branch_from_event_id: Option<String>,
    pub color: String,
    pub tags: Vec<String>,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    #[serde(rename = "updatedAt")]
    pub updated_at: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Event {
    pub id: String,
    pub title: String,
    pub description: String,
    pub date: String,
    #[serde(rename = "endDate")]
    pub end_date: Option<String>,
    #[serde(rename = "timelineId")]
    pub timeline_id: String,
    pub importance: i32,
    #[serde(rename = "iconId")]
    pub icon_id: String,
    pub causes: Vec<String>,
    pub effects: Vec<String>,
    #[serde(rename = "linkedCharacterIds")]
    pub linked_character_ids: Vec<String>,
    #[serde(rename = "linkedLocationIds")]
    pub linked_location_ids: Vec<String>,
    #[serde(rename = "linkedTechnologyIds")]
    pub linked_technology_ids: Vec<String>,
    #[serde(rename = "linkedCultureIds")]
    pub linked_culture_ids: Vec<String>,
    #[serde(rename = "linkedSourceDocumentIds")]
    pub linked_source_document_ids: Vec<String>,
    pub notes: String,
    pub tags: Vec<String>,
    #[serde(rename = "isPointOfDivergence")]
    pub is_point_of_divergence: bool,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PointOfDivergence {
    pub id: String,
    pub name: String,
    pub description: String,
    pub date: String,
    #[serde(rename = "timelineId")]
    pub timeline_id: String,
    #[serde(rename = "parentTimelineId")]
    pub parent_timeline_id: Option<String>,
    #[serde(rename = "eventIds")]
    pub event_ids: Vec<String>,
    #[serde(rename = "resultingTimelineIds")]
    pub resulting_timeline_ids: Vec<String>,
    #[serde(rename = "plausibilityRating")]
    pub plausibility_rating: i32,
    pub notes: String,
    pub tags: Vec<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Character {
    pub id: String,
    pub name: String,
    pub description: String,
    #[serde(rename = "birthDate")]
    pub birth_date: Option<String>,
    #[serde(rename = "deathDate")]
    pub death_date: Option<String>,
    #[serde(rename = "timelineIds")]
    pub timeline_ids: Vec<String>,
    #[serde(rename = "relatedCharacterIds")]
    pub related_character_ids: Vec<String>,
    #[serde(rename = "linkedEventIds")]
    pub linked_event_ids: Vec<String>,
    pub locations: Vec<String>,
    pub traits: Vec<String>,
    pub motivation: String,
    pub background: String,
    pub notes: String,
    #[serde(rename = "isHistorical")]
    pub is_historical: bool,
    #[serde(rename = "imageUrl")]
    pub image_url: Option<String>,
    pub tags: Vec<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Location {
    pub id: String,
    pub name: String,
    pub description: String,
    pub coordinates: Option<Coordinates>,
    #[serde(rename = "timelineIds")]
    pub timeline_ids: Vec<String>,
    #[serde(rename = "parentLocationId")]
    pub parent_location_id: Option<String>,
    #[serde(rename = "linkedEventIds")]
    pub linked_event_ids: Vec<String>,
    #[serde(rename = "foundedDate")]
    pub founded_date: Option<String>,
    #[serde(rename = "destroyedDate")]
    pub destroyed_date: Option<String>,
    pub population: Option<i64>,
    pub importance: i32,
    #[serde(rename = "locationType")]
    pub location_type: String,
    pub notes: String,
    #[serde(rename = "mapUrl")]
    pub map_url: Option<String>,
    pub tags: Vec<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Coordinates {
    pub lat: f64,
    pub lng: f64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Technology {
    pub id: String,
    pub name: String,
    pub description: String,
    #[serde(rename = "discoveryDate")]
    pub discovery_date: Option<String>,
    #[serde(rename = "timelineIds")]
    pub timeline_ids: Vec<String>,
    #[serde(rename = "prerequisiteTechIds")]
    pub prerequisite_tech_ids: Vec<String>,
    #[serde(rename = "derivedTechIds")]
    pub derived_tech_ids: Vec<String>,
    pub inventors: Vec<String>,
    #[serde(rename = "linkedEventIds")]
    pub linked_event_ids: Vec<String>,
    #[serde(rename = "developmentLevel")]
    pub development_level: i32,
    pub impact: i32,
    pub fields: Vec<String>,
    pub notes: String,
    pub tags: Vec<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Culture {
    pub id: String,
    pub name: String,
    pub description: String,
    #[serde(rename = "foundedDate")]
    pub founded_date: Option<String>,
    #[serde(rename = "endDate")]
    pub end_date: Option<String>,
    #[serde(rename = "timelineIds")]
    pub timeline_ids: Vec<String>,
    #[serde(rename = "linkedLocationIds")]
    pub linked_location_ids: Vec<String>,
    #[serde(rename = "linkedCharacterIds")]
    pub linked_character_ids: Vec<String>,
    #[serde(rename = "linkedEventIds")]
    pub linked_event_ids: Vec<String>,
    pub values: Vec<String>,
    pub practices: Vec<String>,
    pub languages: Vec<String>,
    pub beliefs: Vec<String>,
    pub notes: String,
    pub tags: Vec<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SourceDocument {
    pub id: String,
    pub title: String,
    pub description: String,
    pub authors: Vec<String>,
    #[serde(rename = "publicationDate")]
    pub publication_date: Option<String>,
    #[serde(rename = "documentType")]
    pub document_type: String,
    pub url: Option<String>,
    #[serde(rename = "filePath")]
    pub file_path: Option<String>,
    pub notes: String,
    pub tags: Vec<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Narrative {
    pub id: String,
    pub title: String,
    pub description: String,
    pub scenes: Vec<Scene>,
    #[serde(rename = "timelineId")]
    pub timeline_id: Option<String>,
    #[serde(rename = "characterIds")]
    pub character_ids: Vec<String>,
    pub tags: Vec<String>,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    #[serde(rename = "updatedAt")]
    pub updated_at: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Scene {
    pub id: String,
    pub title: String,
    pub description: String,
    pub content: String,
    pub order: i32,
    pub characters: Vec<String>,
    pub locations: Vec<String>,
    #[serde(rename = "eventIds")]
    pub event_ids: Vec<String>,
    pub notes: String,
}
