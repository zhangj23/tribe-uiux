"""
Mapping from Destrieux atlas regions to UX-relevant metric groups.

The Destrieux atlas provides 76 labels per hemisphere on the fsaverage5 surface
(10,242 vertices per hemisphere, 20,484 total). We group these anatomical regions
into 6 interpretable UX metrics.

Region names reference the Destrieux 2009 atlas labels as provided by nilearn.
"""

# Each key is a UX metric name. Each value is a list of substrings that match
# Destrieux atlas label names. A vertex belongs to a metric group if its atlas
# label contains any of the listed substrings.

UX_REGION_GROUPS = {
    "visual_processing": [
        "S_calcarine",       # V1 - primary visual cortex
        "G_cuneus",          # V2 - early visual processing
        "G_oc-temp_lat-fusifor",  # lateral occipitotemporal (partial)
        "S_oc_sup_and_transversal",  # superior occipital sulcus
        "G_and_S_occipital_inf",     # inferior occipital
        "Pole_occipital",    # occipital pole
    ],
    "object_recognition": [
        "G_oc-temp_lat-fusifor",  # fusiform gyrus - faces, objects
        "G_oc-temp_med-Lingual",  # lingual gyrus
        "G_temporal_inf",         # inferior temporal - object recognition
        "S_oc-temp_lat",          # occipitotemporal sulcus
    ],
    "reading_language": [
        "G_temp_sup-Lateral",     # superior temporal gyrus (Wernicke's area)
        "S_temporal_sup",         # superior temporal sulcus
        "G_pariet_inf-Angular",   # angular gyrus - reading
        "G_pariet_inf-Supramar",  # supramarginal gyrus
        "G_front_inf-Opercular",  # Broca's area (pars opercularis)
        "G_front_inf-Triangul",   # Broca's area (pars triangularis)
        "S_front_inf",            # inferior frontal sulcus
    ],
    "attention_salience": [
        "S_intrapariet_and_P_trans",  # intraparietal sulcus - spatial attention
        "G_and_S_paracentral",        # paracentral lobule
        "S_precentral-sup-part",      # frontal eye fields (superior precentral)
        "G_and_S_cingul-Mid-Ant",     # anterior mid-cingulate - salience
        "G_front_sup",                # superior frontal - attention control
        "S_front_sup",                # superior frontal sulcus
    ],
    "cognitive_load": [
        "G_front_middle",        # dorsolateral prefrontal cortex
        "S_front_middle",        # middle frontal sulcus
        "G_and_S_cingul-Ant",    # anterior cingulate - conflict monitoring
        "G_front_sup",           # superior frontal - working memory
        "G_and_S_cingul-Mid-Ant",  # mid-anterior cingulate
    ],
    "emotional_response": [
        "G_and_S_cingul-Mid-Post",  # posterior mid-cingulate
        "G_orbital",                 # orbitofrontal cortex
        "G_rectus",                  # gyrus rectus (medial OFC)
        "S_orbital_lateral",         # lateral orbital sulcus
        "S_orbital-H_Shaped",        # H-shaped orbital sulcus
        "Pole_temporal",             # temporal pole - social/emotional
        "G_Ins_lg_and_S_cent_ins",   # insula - interoception
        "G_insular_short",           # short insular gyri
    ],
}

# Display names for the frontend
UX_METRIC_LABELS = {
    "visual_processing": "Visual Processing",
    "object_recognition": "Object/Face Recognition",
    "reading_language": "Reading & Language",
    "attention_salience": "Attention & Salience",
    "cognitive_load": "Cognitive Load",
    "emotional_response": "Emotional Response",
}

# Interpretation guidelines for z-scores
Z_SCORE_INTERPRETATION = {
    (-999, -1.0): "low",
    (-1.0, 1.0): "normal",
    (1.0, 2.0): "elevated",
    (2.0, 999): "extreme",
}
