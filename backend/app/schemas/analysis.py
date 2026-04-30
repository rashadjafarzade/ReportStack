from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from app.models.analysis import DefectType, AnalysisSource


class FailureAnalysisResponse(BaseModel):
    id: int
    test_item_id: int
    defect_type: DefectType
    confidence: float
    reasoning: Optional[str]
    source: AnalysisSource
    model_name: Optional[str]
    prompt_version: Optional[str]
    created_at: datetime
    overridden_by: Optional[int]

    model_config = {"from_attributes": True}


class AnalysisOverride(BaseModel):
    defect_type: DefectType
    reasoning: Optional[str] = None


class LaunchAnalysisSummary(BaseModel):
    total_analyzed: int
    product_bug: int
    automation_bug: int
    system_issue: int
    no_defect: int
    to_investigate: int
