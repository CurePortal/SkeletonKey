use std::error::Error;
use std::fmt;

#[derive(Debug)]
pub enum AppError {
    FileError(String),
    ParseError(String),
    SerializeError(String),
    #[allow(dead_code)] // These variants might be used in the future
    NotFoundError(String),
    #[allow(dead_code)]
    ValidationError(String),
    // Add more error types as needed
}

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            AppError::FileError(msg) => write!(f, "File error: {}", msg),
            AppError::ParseError(msg) => write!(f, "Parse error: {}", msg),
            AppError::SerializeError(msg) => write!(f, "Serialization error: {}", msg),
            AppError::NotFoundError(msg) => write!(f, "Not found error: {}", msg),
            AppError::ValidationError(msg) => write!(f, "Validation error: {}", msg),
        }
    }
}

impl Error for AppError {}
