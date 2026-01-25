#search_engeine.py
import json
from concurrent.futures import ThreadPoolExecutor
from google import genai
from google.genai import types

class SearchEngine:
    def __init__(self, storage, embedder, query_agent_api_key, search_agent_api_key, query_model_name, search_model_name):
        self.storage = storage
        self.embedder = embedder
        self.query_client = genai.Client(api_key=query_agent_api_key)
        self.search_agent_client = genai.Client(api_key=search_agent_api_key)
        self.query_model_name = query_model_name
        self.search_model_name = search_model_name
        self.threshold = 7.5

        # 1. Schema הממוקד בדירוג של כל משפט בנפרד בתוך הבלוק
        self.response_schema = {
            "type": "OBJECT",
            "properties": {
                "identified_matches": {
                    "type": "ARRAY",
                    "items": {
                        "type": "OBJECT",
                        "properties": {
                            "sentence_id": {
                                "type": "INTEGER",
                                "description": "The ID [0-5] of the specific sentence in the block."
                            },
                            "step_1_inventory": {
                                "type": "STRING", 
                                "description": "Keywords found specifically in THIS sentence."
                            },
                            "step_2_resolution": {
                                "type": "STRING", 
                                "description": "Pronoun mapping using the whole block context (e.g., 'he' -> 'Alex')."
                            },
                            "reasoning": {
                                "type": "STRING", 
                                "description": "Bridge Test logic for this specific sentence."
                            },
                            "score": {
                                "type": "NUMBER",
                                "description": "Score 0.0-10.0 for this sentence specifically."
                            }
                        },
                        "required": ["sentence_id", "step_1_inventory", "step_2_resolution", "reasoning", "score"]
                    }
                }
            },
            "required": ["identified_matches"]
        }

        self.system_instruction = """
ROLE: Deterministic Hebrew Linguistic Auditor.
MISSION: Score the link between QUERY and SENTENCE based on a Hierarchy of Material Evidence.

### PHASE 1: THE HIERARCHY OF EVIDENCE (Rules)

1. RULE 1: ROOT SUPREMACY (Score 9.5-10.0)
   - Exact morphological root match within the current sentence ONLY.
   - Example: "לבקש" -> "ביקשתי".

2. RULE 2: COMPONENT & FUNCTIONAL MATCH (Score 8.5-9.4)
   - The sentence contains a MANDATORY COMPONENT or a DIRECT PHYSICAL CONSEQUENCE.
   - THE INCLUSION TEST: Is X an integral part of Y's definition?
     - YES (Match): "Algorithm" is part of "AI". "Teacher" is part of "School". "Burned" is a physical state of "Tanning".
     - NO (Reject): "Child" is NOT a component of "Father". "Summer" is NOT a component of "Tanning".
   - Logic: Focus on "Part-of" relations, not "Associated-with" relations.

3. RULE 4: SENTENCE ISOLATION (Strict 0.0)
   - No context from previous sentences. 
   - Pronouns (הוא, היא, זה) without the noun in the same sentence MUST score 0.0.

4. RULE 5: CIRCUMSTANTIAL REJECTION (Score < 5.0)
   - Reject "Vague Atmosphere" (Environment, Vibes, or incidental locations).
   - If the word (e.g., 'Summer', 'Sea', 'Classroom') is just the setting where the query happens, it is NOT a match.

5. RULE 6: HALLUCINATION & TYPO GUARD (Strict 0.0)
   - If a word is unrecognized or a suspected ASR typo (e.g., "הצטפר"), do NOT infer meaning. Score 0.0.

### PHASE 2: MANDATORY SCORING RUBRIC
- 9.5 - 10.0: Root Match.
- 8.5 - 9.4: Pass the Inclusion Test (Essential Component / Physical Result).
- 0.0 - 7.4: REJECT (Logical Leaps, Atmosphere, Pronouns, or Typos).

### OUTPUT PROTOCOL (JSON):
{
"sentence_id": [0-5],
"step_1_inventory": "Substantive keywords only.",
"step_2_resolution": "Identify if the link is Root, Component, or Physical.",
"reasoning": "MANDATORY: State 'MATCH/REJECT by Rule [X]'. Explain why using the Inclusion Test logic in 1 English sentence.",
"score": 0.0 or 7.5-10.0
}
"""

    def refine_query(self, query):
        refine_prompt = f"""
ROLE: Hebrew Search Optimizer & Domain Architect.
TASK: Analyze the Hebrew query and extract search components to support Root-Based and Associative search logic.

1. ATOMIC KEYWORD EXTRACTION & DOMAIN EXPANSION:
   - Extract ALL substantive "Content Anchors" (Nouns, Verbs, Proper Names).
   - ATOMICITY: Each string must be a single word (except inseparable phrases like "בינה מלאכותית").
   - STRICTLY FORBIDDEN: Exclude all stop-words and prepositions (e.g., "של", "על", "את").
   - MORPHOLOGICAL EXPANSION: Include 3-letter roots for core words (e.g., "שקע" for "השקעה").
   - DOMAIN EXPANSION: For key concepts, add 2-3 highly-related "Domain Anchors" (e.g., for "בית ספר" add ["מורה", "תלמיד", "כיתה"]).
   - LANGUAGE INTEGRITY: Ensure all keywords are valid, existing Hebrew words. Avoid hallucinating non-existent inflections.

2. DOMAIN BROADENING: Define the query's broader conceptual domain (e.g., "Investments" -> "Banking, stocks, and financial management").

3. NO CONTEXTUAL BIAS: Do not add constraints not in the original query.

4. CLEANLINESS & ANCHORING: 'semantic_focus' must be a descriptive Hebrew sentence.
   - MANDATORY: Include the core query subject or name (e.g., "אולגה", "כסף") within this sentence.
   - SEMANTIC BREADTH: Incorporate the "Domain Anchors" from Rule 1 into this sentence to broaden the vector search (e.g., "חיפוש מידע על בית ספר, כולל התייחסויות למורים, תלמידים או כיתות לימוד").
   - PRONOUNS: For personal pronouns (e.g., "אני"), focus on the act of speaking or self-reference.

5. PROPER NAMES: If the query is a person's name (e.g., "Olga"):
   - Set 'exact_keywords' to the name and common Hebrew prefixes (e.g., ["אולגה", "לאולגה", "ואולגה"]).
   - Set 'semantic_focus' to a sentence specifically naming the person.

QUERY: "{query}"

RETURN JSON ONLY:
{{
"exact_keywords": ["anchor1", "root1", "anchor2", "..."], 
"semantic_focus": "A clean, descriptive semantic sentence in Hebrew that defines the domain"
}}
"""
   

        try:
            response = self.query_client.models.generate_content(
                model=self.query_model_name,
                contents=refine_prompt,
                config=types.GenerateContentConfig(response_mime_type="application/json")
            )
            data = json.loads(response.text)

            if isinstance(data, list) and len(data) > 0:
                data = data[0]

            if not isinstance(data, dict):
                return {"exact_keywords": [query], "semantic_focus": query}
            
            return data
        except:
            return {"exact_keywords": [query], "semantic_focus": query}

    def gemini_judge_worker(self, query, res, user_id):
        """מנתח בלוק ומפרק אותו למשפטים מדורגים בנפרד"""
        try:
            sentences_text = "\n".join([f"[{i}]: {s['text']}" for i, s in enumerate(res['sentences'])])
            
            config = types.GenerateContentConfig(
                system_instruction=self.system_instruction,
                response_mime_type="application/json",
                response_schema=self.response_schema,
                temperature=0,
                thinking_config=types.ThinkingConfig(include_thoughts=True)
            )

            prompt = f"QUERY: '{query}'\n\nBLOCK:\n{sentences_text}"
            
            response = self.search_agent_client.models.generate_content(
                model=self.search_model_name,
                contents=[prompt],
                config=config
            )
            data = json.loads(response.text)
            
            matches_from_block = []
            for match in data.get('identified_matches', []):
                s_id = match['sentence_id']
                if s_id >= len(res['sentences']): continue
                
                score = float(match['score'])
                if score < self.threshold: continue # סינון משפטים שלא עברו את הסף

                sentence_data = res['sentences'][s_id]
                
                matches_from_block.append({
                    "text": sentence_data['text'],
                    "start": sentence_data['start'],
                    "end": sentence_data['end'],
                    "score": score,
                    "user_id": user_id,
                    "reasoning": f"ST1: {match['step_1_inventory']} | ST2: {match['step_2_resolution']} | ST3: {match['reasoning']}",
                    "file_name": res.get("file_name", "unknown")
                })
            return matches_from_block
        except Exception as e:
            print(f"Error in judge worker: {e}")
            return []

# --- פונקציית עזר חדשה להפרדת הלוגיקה ---
    def _deduplicate_sentences(self, matches):
        """שומר רק את המופע הייחודי של משפט עם הציון הגבוה ביותר"""
        unique_matches = {}
        for match in matches:
            # מפתח מבוסס קובץ וזמן התחלה
            unique_key = f"{match['file_name']}_{round(match['start'], 2)}"
            # שמירת הציון הגבוה ביותר מבין המופעים
            if unique_key not in unique_matches or match['score'] > unique_matches[unique_key]['score']:
                unique_matches[unique_key] = match

        return list(unique_matches.values())

    def rerank_results(self, query, user_id, candidates):
        """שלב הדירוג העמוק"""
        # ניקוי כפילויות ברמת הבלוקים לפני השליחה ל-Gemini
        # (מניעת שליחת אותו בלוק פעמיים)
        seen_blocks = set()
        unique_targets = []
        for c in candidates:
            # נניח שלכל בלוק יש מזהה ייחודי בשם block_id
            b_id = c.get('block_id', f"{c['file_name']}_{c['sentences'][0]['start']}")
            if b_id not in seen_blocks:
                unique_targets.append(c)
                seen_blocks.add(b_id)

        targets = unique_targets[:20] 
        all_matches = []

        with ThreadPoolExecutor(max_workers=min(len(targets), 20)) as executor:
            list_of_results = list(executor.map(lambda c: self.gemini_judge_worker(query, c, user_id), targets))
            for sublist in list_of_results:
                if sublist:
                    all_matches.extend(sublist)

        # שימוש בפונקציית העזר לניקוי כפילויות ברמת המשפט לאחר הדירוג
        final_results = self._deduplicate_sentences(all_matches)
        
        return sorted(final_results, key=lambda x: x["score"], reverse=True)

    def search(self, query: str, user_id:str, top_k=5):
        print(f"Search for User: {user_id} | Query: {query}")
        refined = self.refine_query(query)
        print(f"Refined Query: {refined}")
        exact_terms = refined.get("exact_keywords", [query])
        
        candidates = []
        # 1. חיפוש טקסטואלי
        for term in exact_terms:
            candidates.extend(self.storage.exact_search(term, user_id=user_id))
        
        # 2. חיפוש וקטורי
        q_vec = self.embedder.encode(f"query: {refined.get('semantic_focus', query)}", normalize_embeddings=True)
        candidates.extend(self.storage.search_vector(q_vec, user_id=user_id, k=25))
        
        # 3. דירוג מחדש (הפונקציה עכשיו מנקה כפילויות גם לפני וגם אחרי ה-Judge)
        results = self.rerank_results(query, user_id, candidates)[:top_k]
         
        print(results)
        return results
#         self.system_instruction = """
# ROLE: Expert Hebrew Linguistic Auditor with Association-Based Scoring.
# MISSION: Evaluate the link between a QUERY and each SENTENCE in the provided BLOCK using strict morphological sovereignty and hierarchical associations.

# ### PHASE 1: UNIVERSAL AUDIT RULES (Deterministic Principles)

# 1. MORPHOLOGICAL SOVEREIGNTY (ROOT MATCH):
#    - High score (9.5-10.0) for sentences containing the EXACT Hebrew root of the query.
#    - You MUST identify the 3-letter root correctly. Synonyms with different roots are NOT a Root Match.
#    - Example: 'לבקש' (בק"ש) and 'לשאול' (שא"ל) are DIFFERENT roots.

# 2. THE NO-REPLACEMENT PRINCIPLE:
#    - Never replace or substitute words in the output. Explain the bridge without changing the original text.
#    - INVENTORY FILTER: Include only substantive keywords or entities in 'step_1_inventory'. Omit generic pronouns like 'זה', 'הוא', 'היא'.

# 3. PRONOUN PROTOCOL:
#    - NAMES/PEOPLE: Score 0.0-2.0 for personal names mapped only to pronouns (הוא, היא).
#    - DOMAINS/OBJECTS: Pronouns may refer to abstract domains or objects if context is clear.

# 4. EXTENDED ASSOCIATIVE HIERARCHY:
#    - Bridge query to tools (Computer->Keyboard), roles (School->Principal), famous icons (Investments->Warren Buffett), and cause/effect (Tanning->Burnt).

# 5. ANTI-HALLUCINATION & INTERJECTION GUARD (CRITICAL):
#    - INTERJECTIONS: Short utterances or stutters (e.g., 'אה', 'אממ', 'נו', 'אהה') are NOT matches for any noun/verb.
#    - FALSE ROOTS: Do not hallucinate shared roots for synonyms. Synonyms score < 7.5 unless a strong domain bridge exists.

# 6. ANCHOR ISOLATION & THRESHOLD:
#    - Score >= 7.5 is mandatory for a return. Evaluate ONLY the current sentence.

# 7. CONCEPT INTEGRITY (COMPOUND QUERIES):
#    - If the query is a compound noun or a specific domain (e.g., "למידת מכונה", "בינה מלאכותית"), a Root Match on only one of the words (e.g., just "למדה") is NOT enough for a high score.
#    - For such cases, if the sentence lacks the "Machine/Technology" context, the score MUST be dropped to 0.0-4.0 (Irrelevant context), even if the root matches.
#    - A Root Match for a single word in a compound concept is a "Weak Link" unless the domain bridge is clear.

# ### PHASE 2: GUIDING EXAMPLES FOR LOGICAL GENERALIZATION

# #### CATEGORY A-D: Positive Associations
# - Query: "Singer" | Sentence: "Eyal Golan gave a show" | Score: 9.4 (Encyclopedic).
# - Query: "Computer" | Sentence: "The keyboard is stuck" | Score: 8.8 (Tool).
# - Query: "Money" | Sentence: "I have a million dollars" | Score: 9.4 (Currency).

# #### CATEGORY E-F: Negative Guards (Rejection)
# - Query: "Olga" | Sentence: "She told me everything" | Score: 2.0 (Pronoun Protocol).
# - Query: "אהבה" | Sentence: "אה, אה, אני כבר בא" | Score: 0.0 (Interjection Guard).
# - Query: "לבקש" | Sentence: "רציתי לשאול משהו" | Score: 6.0 (Different Roots - Hallucination Guard).

# ### OUTPUT PROTOCOL (JSON):
# {
# "sentence_id": [0-5],
# "step_1_inventory": "Identify the specific word and its 3-letter root (if root match)",
# "step_2_resolution": "Logical explanation (No word replacement)",
# "reasoning": "Brief English logic (Max 2 sentences) referencing Rules.",
# "score": 7.5-10.0
# }
# """


#            refine_prompt = f"""
# ROLE: Hebrew Search Optimizer & Domain Architect.
# TASK: Analyze the Hebrew query and extract search components to support Root-Based and Associative search logic.

# 1. ATOMIC KEYWORD EXTRACTION & DOMAIN EXPANSION:
#    - Extract ALL substantive "Content Anchors" (Nouns, Verbs, Proper Names).
#    - ATOMICITY: Each string must be a single word (except inseparable phrases like "בינה מלאכותית").
#    - STRICTLY FORBIDDEN: Exclude all stop-words and prepositions (e.g., "של", "על", "את").
#    - MORPHOLOGICAL EXPANSION: Include 3-letter roots for core words (e.g., "שקע" for "השקעה").
#    - DOMAIN EXPANSION (NEW): For key concepts, add 2-3 highly-related "Domain Anchors" that represent roles, tools, or related entities. 
#      - Example for "בית ספר": Add ["מורה", "תלמיד", "כיתה"].
#      - Example for "בינה מלאכותית": Add ["מודל", "אלגוריתם", "AI"].
#    - NO FIXED LIMIT: Use as many anchors as needed to cover the conceptual domain, focusing on words likely to appear in natural speech.

# 2. DOMAIN BROADENING: Define the query's broader conceptual domain (e.g., "Investments" -> "Banking, stocks, and financial management").

# 3. NO CONTEXTUAL BIAS: Do not add constraints not in the original query.

# 4. CLEANLINESS & ANCHORING: 'semantic_focus' must be a descriptive Hebrew sentence.
#    - MANDATORY: Include the core query subject or name (e.g., "אולגה", "כסף") within this sentence.
#    - RULE: Use the subject to anchor the vector search (e.g., "חיפוש מידע הקשור להשקעות של וורן באפט").
#    - PRONOUNS: For personal pronouns (e.g., "אני", "הוא"), focus the semantic description on the act of speaking or the identity of the subject (e.g., "חיפוש התייחסויות של הדובר על עצמו ופעולותיו").

# 5. PROPER NAMES: If the query is a person's name (e.g., "Olga"):
#    - Set 'exact_keywords' to the name and common Hebrew prefixes (e.g., ["אולגה", "לאולגה", "ואולגה"]).
#    - Set 'semantic_focus' to a sentence specifically naming the person.

# QUERY: "{query}"

# RETURN JSON ONLY:
# {{
# "exact_keywords": ["anchor1", "root1", "anchor2", "..."], 
# "semantic_focus": "A clean, descriptive semantic sentence in Hebrew that defines the domain"
# }}
# """
   
   
    # def rerank_results(self, query, candidates):
    #     """מבצע דירוג מקבילי ומטפל בכפילויות של משפטים בגלל חפיפת בלוקים"""
    #     targets = candidates[:12] # מספר הבלוקים לניתוח עומק
    #     all_matches = []

    #     with ThreadPoolExecutor(max_workers=len(targets)) as executor:
    #         list_of_results = list(executor.map(lambda c: self.gemini_judge_worker(query, c), targets))
    #         for sublist in list_of_results:
    #             if sublist:
    #                 all_matches.extend(sublist)

    #     # --- מנגנון ניקוי כפילויות (Deduplication) ---
    #     # מכיוון שמשפט יכול להופיע ב-3 בלוקים, נשמור רק את המופע עם הציון הגבוה ביותר
    #     unique_matches = {}
    #     for match in all_matches:
    #         # מפתח ייחודי מבוסס על קובץ וזמן התחלה (מעוגל למניעת סטיות צפות)
    #         unique_key = f"{match['file_name']}_{round(match['start'], 2)}"
            
    #         if unique_key not in unique_matches:
    #             unique_matches[unique_key] = match
    #         else:
    #             # אם מצאנו את אותו משפט בבלוק אחר, ניקח את הציון הגבוה ביותר
    #             if match['score'] > unique_matches[unique_key]['score']:
    #                 unique_matches[unique_key] = match

    #     # המרה חזרה לרשימה ומיון סופי לפי ציון
    #     final_results = list(unique_matches.values())
    #     return sorted(final_results, key=lambda x: x["score"], reverse=True)

    # def search(self, query: str, top_k=5):
    #     # 1. זיקוק השאילתה
    #     refined = self.refine_query(query)
    #     print(f"original query: {query}")
    #     print(f"Refined Query: {refined}")
    #     exact_terms = refined.get("exact_keywords", [query])
        
    #     # 2. איסוף מועמדים מחיפוש טקסטואלי וסמנטי (החזרת בלוקים)
    #     candidates = []
    #     for term in exact_terms:
    #         candidates.extend(self.storage.exact_search(term))
        
    #     q_vec = self.embedder.encode(f"query: {refined.get('semantic_focus', query)}", normalize_embeddings=True)
    #     candidates.extend(self.storage.search_vector(q_vec, k=15))
        
    #     # 3. דירוג מחדש, ניקוי כפילויות והחזרת המשפטים הטובים ביותר
    #     # אנחנו לא עושים דה-דופליקציה כאן כי ה-rerank מטפל בזה ברמת המשפט
    #     return self.rerank_results(query, candidates)[:top_k]
    


        # refine_prompt = f"""
        # ROLE: Hebrew Search Optimizer & Domain Architect.
        # TASK: Analyze the Hebrew query and extract search components to support Root-Based and Associative search logic.

        # INSTRUCTIONS:
        # 1. MORPHOLOGICAL ROOTS: Identify the core Hebrew root (שורש) and primary inflections of the query. 
        # - Place each as a SEPARATE, clean string in the 'exact_keywords' list.
        # - Example for "השקעה": ["שקע", "השקעה", "להשקיע", "משקיע"].
        # - STRICTLY AVOID: Slashes (/), commas, or combined strings like "root/word".

        # 2. DOMAIN BROADENING (Semantic Focus): Define the query's broader conceptual domain to guide vector search.
        # - Expand to include the domain hierarchy (e.g., Query "Flight" -> Focus "Aviation, aircraft, and airport activities").
        # - For financial queries, include "banking and currency concepts".
        # - For professional queries, include "associated roles and tools".

        # 3. NO CONTEXTUAL BIAS: Maintain neutrality. Do NOT add sub-categories or constraints that were not in the original query (e.g., if query is "חבר", do NOT add "כנסת" or "חבר טוב"). Stay at the natural category level.

        # 4. CLEANLINESS: The 'semantic_focus' must be a clean, descriptive Hebrew sentence that defines the "conceptual neighborhood" without being overly specific.

        # QUERY: "{query}"

        # RETURN JSON ONLY:
        # {{
        # "exact_keywords": ["word1", "word2", "root1", "word3"], 
        # "semantic_focus": "A clean, descriptive semantic sentence in Hebrew that defines the domain"
        # }}
        # """  

#         self.system_instruction = """
# ROLE: Expert Hebrew Linguistic Auditor with Association-Based Scoring.
# MISSION: Evaluate the link between a QUERY and each SENTENCE in the provided BLOCK using strict morphological sovereignty and hierarchical associations.

# ### PHASE 1: UNIVERSAL AUDIT RULES (Deterministic Principles)

# 1. MORPHOLOGICAL SOVEREIGNTY (ROOT MATCH):
# - High score (9.5-10.0) for sentences containing the EXACT Hebrew root of the query.
# - You MUST identify the 3-letter root correctly. Synonyms with different roots are NOT a Root Match.

# 2. THE NO-REPLACEMENT PRINCIPLE:
# - Never replace or substitute words in the output. Explain the bridge without changing the original text.

# 3. PRONOUN PROTOCOL:
# - NAMES/PEOPLE: Score 0.0-2.0 for personal names mapped only to pronouns.
# - DOMAINS/OBJECTS: Pronouns may refer to abstract domains or objects if context is clear.

# 4. EXTENDED ASSOCIATIVE HIERARCHY:
# - Bridge query to tools, roles, famous icons (Warren Buffett), and cause/effect (Tanning -> Burnt).

# 5. ANTI-HALLUCINATION & INTERJECTION GUARD (CRITICAL):
# - INTERJECTIONS: Short utterances or stutters (e.g., 'אה', 'אממ', 'נו') are NOT matches.
# - FALSE ROOTS: Do not hallucinate shared roots. 'לבקש' (בק"ש) and 'לשאול' (שא"ל) are DIFFERENT.

# 6. ANCHOR ISOLATION & THRESHOLD:
# - Score >= 7.5 is mandatory for a return.

# ### PHASE 2: GUIDING EXAMPLES FOR LOGICAL GENERALIZATION

# #### CATEGORY A: Domain Entities & Famous Icons
# - Query: "Singer" | Sentence: "Eyal Golan gave a great show" | Score: 9.4.
# - Query: "Investments" | Sentence: "Warren Buffett bought more stocks" | Score: 9.2.

# #### CATEGORY B: Tools, Roles & Locations
# - Query: "Computer" | Sentence: "The keyboard is stuck" | Score: 8.8.
# - Query: "School" | Sentence: "The principal called a meeting" | Score: 9.0.
# - Query: "Flight" | Sentence: "The pilot announced a delay" | Score: 9.2.

# #### CATEGORY C: Cause, Effect & Physiological Results
# - Query: "Tanning" | Sentence: "I got badly burnt in the sun" | Score: 8.8.
# - Query: "Money" | Sentence: "I have a million dollars in savings" | Score: 9.4.
# - Query: "Apartment" | Sentence: "The rent is too high" | Score: 8.5.

# #### CATEGORY D: Family & Relationship Clusters
# - Query: "Family" | Sentence: "My son and daughter are coming" | Score: 9.5.

# #### CATEGORY E: Strict Rejection (Pronouns & Names)
# - Query: "Olga" | Sentence: "She told me everything" | Score: 2.0.

# #### CATEGORY F: False Positives & Hallucination Prevention (Negative Training)
# - Query: "אהבה" | Sentence: "אה, אה, אני כבר בא" | Score: 0.0 (Logic: 'אה' is an interjection, not 'Love').
# - Query: "לבקש" | Sentence: "רציתי לשאול משהו" | Score: 6.0 (Logic: Different roots, synonym only).

# ### OUTPUT PROTOCOL (JSON):
# {
# "sentence_id": [0-5],
# "step_1_inventory": "Identify the specific word and its 3-letter root (if root match)",
# "step_2_resolution": "Logical explanation (No word replacement)",
# "reasoning": "English logic referencing Rules",
# "score": 7.5-10.0
# }
#         """



# import json
# from concurrent.futures import ThreadPoolExecutor
# from google import genai
# from google.genai import types

# class SearchEngine:
#     def __init__(self, storage, embedder, api_key, model_name):
#         self.storage = storage
#         self.embedder = embedder
#         self.client = genai.Client(api_key=api_key)
#         self.model_name = model_name
#         self.threshold = 7.5
        

#         self.response_schema = {
#             "type": "OBJECT",
#             "properties": {
#                 "selected_sentence_id": {
#                     "type": "INTEGER",
#                     "description": "The ID of the sentence within the block that best matches the query."
#                 },
#                 "step_1_inventory": {"type": "STRING", "description": "Keywords found in the SELECTED SENTENCE."},
#                 "step_2_resolution": {"type": "STRING", "description": "Pronoun mapping."},
#                 "reasoning": {"type": "STRING", "description": "Logic following the BRIDGE TEST."},
#                 "score": {"type": "NUMBER", "description": "Final score between 0.0 and 10.0"}
#             },
#             "required": ["selected_sentence_id", "step_1_inventory", "step_2_resolution", "reasoning", "score"]
#         }

#         # 2. הוראות מערכת מלאות הכוללות דוגמאות (במקום History)
#         self.system_instruction = """

# ROLE: Expert Hebrew Linguistic Auditor with Association-Based Scoring.
# MISSION: Evaluate the link between QUERY and ANCHOR using strict morphological sovereignty, query gating, and association hierarchy.
# TASK:
# 1. Identify which specific sentence in the BLOCK is the strongest 'Anchor' for the query.
# 2. Evaluate that sentence using strict morphological sovereignty and association rules.
# 3. Return the index (ID) of that sentence and its score.

# RULE SET 0: QUERY TYPE GATING
# Classify the QUERY into one of these containers to determine logic:

# ENTITY/NAME/OBJECT: Specific names, Cities, or concrete items (e.g., 'אולגה', 'ירושלים', 'פטיש'). Logic: Strict. Requires exact name or direct pronoun.

# ACTION/VERB/PROCESS: Activities, states, or processes (e.g., 'כסף', 'שיזוף', 'אוכל', 'רצה'). Logic: Functional. Allows for root inflections and causal results.

# DOMAIN/CONCEPT: Abstract topics or professional fields (e.g., 'ביטוח', 'ספורט', 'שתייה חמה'). Logic: Associative. Allows for roles, ingredients, and institutional elements.

# RULE SET 1: MORPHOLOGICAL SOVEREIGNTY (שורש)
# ROOT MATCH (SCORE: 9.5-10.0): If the ANCHOR contains a word with the EXACT same Hebrew root as the QUERY, it MUST receive a high score, even if used as slang or metaphor (e.g., 'אכלתי אותה' for 'אוכל', 'רציתי' for 'רצה').

# IDIOM DISQUALIFICATION: If the link is NOT based on a shared root but on an association (e.g., 'נשרף' for 'שיזוף'), and it is used metaphorically (e.g., 'נשרף אצלי' = social rejection), the score must be 0.0.

# RULE SET 2: ASSOCIATION & MATCHING HIERARCHY
# CORE ASSOCIATION (SCORE: 8.5-9.4): ANCHOR contains a PRIMARY entity/result defining the domain. Examples: 'שיזוף' -> 'אדום' (8.5), 'ביטוח' -> 'סוכן' (8.8), 'בית ספר' -> 'מורה' (9.5).

# FUNCTIONAL ASSOCIATION (SCORE: 7.5-8.4): ANCHOR contains causes, related tools, or institutions. Example: 'כסף' -> 'מחירים' (8.5), 'בית ספר' -> 'ועד הורים' (8.5).

# DOMAIN CONSISTENCY: If the ANCHOR matches the category but violates a specific sub-type (e.g., 'Cold Cola' for 'Hot Drink'), score must be < 7.0.

# ANCHOR ISOLATION: Evaluate ONLY linguistic material in the ANCHOR. If the QUERY appears in CONTEXT but is missing from ANCHOR (and no pronoun bridge exists), score MUST be 0.0-2.0.

# OUTPUT PROTOCOL (JSON):
# step_1_inventory: List keywords found ONLY in the ANCHOR.

# step_2_resolution: Map pronouns (he, she, it / הוא, היא, לה) to entities in CONTEXT.

# reasoning: State "PASSED/FAILED [TEST NAME]" + brief English logic.

# score: Numeric value based on the hierarchy above.

# FEW-SHOT EXAMPLES:
# QUERY: 'אוכל', ANCHOR: 'אכלתי אותה בגדול', SCORE: 9.5 (Root Sovereignty - Shared Root א-כ-ל).

# QUERY: 'רצה', ANCHOR: 'רציתי בכל זאת לשאול', SCORE: 10.0 (Morphological Match - Root ר-צ-ה).

# QUERY: 'שיזוף', ANCHOR: 'הוא נשרף אצלי', CONTEXT: 'הוא שיקר לי', SCORE: 0.0 (Idiom Disqualification - Metaphorical, No Root Match).

# QUERY: 'שתייה חמה', ANCHOR: 'תביא לי קולה קרה', SCORE: 6.0 (Functional Contradiction - Cold beverage vs Hot query).

# QUERY: 'אולגה', ANCHOR: 'אל תתקשר לפה יותר', CONTEXT: 'מי זו אולגה?', SCORE: 2.0 (Failed Isolation - Query name absent from anchor).

#         """ 


#     def refine_query(self, query):
#         """
#         סוכן חכם שמזקק את השאילתה לפני החיפוש.
#         מחלץ מילות מפתח לחיפוש מדויק ומשפט נקי לחיפוש סמנטי.
#         """
#         refine_prompt = f"""
#         ROLE: Hebrew Search Optimizer.
#         TASK: Extract search terms from the query.

#         INSTRUCTIONS:
#         1. Extract ALL core nouns and verbs (roots) that are essential for the search into 'exact_keywords'.
#         2. The list 'exact_keywords' can contain ANY number of words (1, 2, 5, etc.) depending on the query complexity.
#         3. If no specific keywords exist, return an empty list [].
#         4. Create a clean conceptual sentence for 'semantic_focus'.

#         QUERY: "{query}"

#         RETURN JSON ONLY (Example of structure):
#         {{
#         "exact_keywords": ["מילה1", "מילה2", "..."], 
#         "semantic_focus": "משפט נקי לחיפוש"
#         }}
#         """
#         try:
#             response = self.client.models.generate_content(
#                 model=self.model_name,
#                 contents=refine_prompt,
#                 config=types.GenerateContentConfig(response_mime_type="application/json")
#             )
#             return json.loads(response.text)
#         except:
#             # במקרה של שגיאה, נחזור לשאילתה המקורית כברירת מחדל
#             return {"exact_keywords": [query], "semantic_focus": query}

#     def gemini_judge_worker(self, query, res):
#         """שימוש ב-generate_content ישיר - הכי מהיר וחסכוני"""
#         try:
#             config = types.GenerateContentConfig(
#             system_instruction=self.system_instruction,
#             response_mime_type="application/json",
#             response_schema=self.response_schema,
#             temperature=0.1, # נשארים נמוך לעקביות, למרות ההמלצה הכללית
#             max_output_tokens=600,
#             thinking_config=types.ThinkingConfig(include_thoughts=True)
#         )
#             # שימוש ב-generate_content במקום chats.create
#             response = self.client.models.generate_content(
#                 model=self.model_name,
#                 contents=[f"QUERY: '{query}', ANCHOR: '{res['anchor_text']}', CONTEXT: '{res['window_text']}'"],
#                 config=config
                
#             )
#             data = json.loads(response.text)
            
#             score = float(data.get('score', 0))
#             reasoning = data.get('reasoning', 'No reasoning provided')
            
#             # הגנה דטרמיניסטית ב-Python
#             if "FAILED ISOLATION TEST" in reasoning.upper() or "NO BRIDGE FOUND" in reasoning.upper():
#                 score = min(score, 2.0)

#             full_reasoning = f"ST1: {data.get('step_1_inventory')} | ST2: {data.get('step_2_resolution')} | ST3: {reasoning}"
#             return score, full_reasoning
#         except Exception as e:
#             return 0.0, f"Error: {str(e)}"


#     def rerank_results(self, query, candidates):
#         """דירוג מקבילי לביצועים מהירים"""
#         targets = candidates[:12]
        
#         with ThreadPoolExecutor(max_workers=len(targets)) as executor:
#             results = list(executor.map(lambda c: self.gemini_judge_worker(query, c), targets))
        
#         final_results = []
#         for res, (score, reasoning) in zip(targets, results):
#             if score >= self.threshold:
#                 final_results.append({
#                     "text": res["anchor_text"],
#                     "start": res["start"],
#                     "score": score,
#                     "reasoning": reasoning,
#                     "file_name": res.get("file_name", "unknown")
#                 })
        
#         return sorted(final_results, key=lambda x: x["score"], reverse=True)

#     def _deduplicate(self, results):
#         unique = {}
#         for r in results:
#             key = f"{r.get('file_name')}_{r['start']}"
#             if key not in unique: unique[key] = r
#         return list(unique.values())

#     def search(self, query: str, top_k=5):
#             # 1. שלב הזיקוק החדש (השינוי המוצע)
#             refined = self.refine_query(query)
#             exact_terms = refined.get("exact_keywords", [query])
#             semantic_query = refined.get("semantic_focus", query)

#             # 2. חיפוש מדויק עם מילות המפתח המזוקקות
#             # אנחנו מריצים חיפוש על כל מילת מפתח ומאחדים
#             exact_results = []
#             for term in exact_terms:
#                 exact_results.extend(self.storage.exact_search(term))
            
#             # 3. חיפוש סמנטי עם המשפט המזוקק
#             q_vec = self.embedder.encode(f"query: {semantic_query}", normalize_embeddings=True)
#             semantic_results = self.storage.vector_search(q_vec, k=15)
            
#             # 4. איחוד ודירוג מחדש (המשך הקוד המקורי שלך)
#             candidates = self._deduplicate(exact_results + semantic_results)
            
#             # שימוש בשאילתה המקורית לדירוג הסופי כדי לא לאבד כוונה
#             return self.rerank_results(query, candidates)[:top_k]



# # ROLE: Expert Hebrew Linguistic Auditor with Association-Based Scoring.
# # MISSION: Evaluate the link between QUERY and ANCHOR using strict linguistic rules, query gating, and association hierarchy.

# # 🔒 RULE SET 0: QUERY TYPE GATING
# Classify the QUERY into one of these containers:
# 1. ENTITY/NAME/OBJECT: Specific names, Cities, or concrete items (e.g., 'פטיש').
# 2. ACTION/VERB/PROCESS: Activities, states, or physical processes (e.g., 'כסף', 'שיזוף', 'אוכל').
# 3. DOMAIN/CONCEPT: Abstract topics or professional fields.

# # ⚖️ RULE SET 1: ANCHOR ISOLATION & MORPHOLOGICAL PRIORITY
# 1. MORPHOLOGICAL MATCH (ROOT): If the ANCHOR contains a word with the EXACT same Hebrew root (שורש) as the QUERY, it MUST receive a high score (9.5-10.0), even if used as slang or metaphor (e.g., 'אכלתי אותה' for 'אוכל').
# 2. IDIOM DISQUALIFICATION (INDIRECT ONLY): If the link is NOT based on a shared root but on an association (e.g., 'נשרף' for 'שיזוף'), and the word is used metaphorically (e.g., 'נשרף אצלי' = social rejection), the score must be 0.0.
# 3. ANCHOR ISOLATION: Evaluate ONLY explicit linguistic material in the ANCHOR.

# # 🔗 RULE SET 2: ASSOCIATION & MATCHING HIERARCHY

# ## 2.1 DIRECT & ROOT MATCH (Score: 9.5-10.0)
# - Exact word or shared root. Root match is sovereign (overrides semantic shift).

# ## 2.2 CORE ASSOCIATION (Score: 8.5-9.4)
# - ANCHOR contains a PRIMARY entity/result defining the domain.
# - Example: QUERY: 'שיזוף' -> ANCHOR: 'נשרפתי' (in sun/sea context) = 8.5.

# ## 2.3 FUNCTIONAL ASSOCIATION (Score: 7.5-8.4)
# - ANCHOR contains causes or related actions.
# - Example: QUERY: 'שיזוף' -> ANCHOR: 'השמש פשוט קדחה' = 8.2.

# ## 2.4 REFERENTIAL STRICTNESS (Score: 0.0-7.4)
# - Pure pronouns without supporting keywords are rejected (7.4 cap).

# # 📊 RULE SET 3: SCORING ALGORITHM SUMMARY
# - 9.5-10.0: SHARED ROOT (including metaphors) or DIRECT MATCH.
# - 7.5-9.4: STRONG ASSOCIATIONS (Non-metaphorical).
# - 0.0-7.4: REJECTION (Indirect metaphors, Referential only, No link).

# # EXAMPLES (Few-Shot Learning):
# - QUERY: 'אוכל', ANCHOR: 'אכלתי אותה', SCORE: 9.5 (Root Match - Priority).
# - QUERY: 'שיזוף', ANCHOR: 'הוא פשוט נשרף אצלי', SCORE: 0.0 (Indirect Metaphor - No Root Match).
# - QUERY: 'שיזוף', ANCHOR: 'נשרפתי לגמרי בים', SCORE: 8.5 (Core Association - Physical).
# - QUERY: 'ביטוח', ANCHOR: 'יש לי סוכן תותח', SCORE: 8.8 (Core Association).

# # OUTPUT PROTOCOL:
# 1. Reasoning MUST state "PASSED/FAILED [TEST NAME]".
# 2. Language: English. JSON format only.
# """

# # ROLE: Expert Hebrew Linguistic Auditor with Association-Based Scoring.
# # MISSION: Evaluate the linguistic and semantic link between QUERY and ANCHOR, scoring by association strength using strict hierarchical rules.

# # RULE SET 0: QUERY TYPE GATING
# Classify the QUERY into one of these containers to determine strictness:
# 1. ENTITY/NAME/OBJECT: Specific people, Cities, Brands, or concrete items (e.g., 'אולגה', 'ירושלים', 'פטיש').
#    - Logic: Strict. Requires exact name, direct synonym, or clear pronoun.
# 2. ACTION/VERB/PROCESS: Activities, physical states, or processes (e.g., 'כסף', 'שיזוף', 'אוכל', 'לבקש').
#    - Logic: Functional. Allows for root inflections and causal results.
# 3. DOMAIN/CONCEPT: Broad fields, Emotions, Categories (e.g., 'ספורט', 'ביטוח', 'בית ספר', 'שתייה חמה').
#    - Logic: Associative. Allows for roles, ingredients, and institutional elements.

# # RULE SET 1: LINGUISTIC PRIORITIES & IDIOM GUARD
# 1. ROOT SOVEREIGNTY (שורש): If the ANCHOR contains a word with the EXACT same Hebrew root as the QUERY, it MUST receive 9.5-10.0. This is the SOVEREIGN rule and overrides slang/metaphorical shifts. 
#    - Includes: Singular/Plural (ביצה/ביצים), and all verb inflections (בקשה/ותבקש). 
#    - Example: 'אכלתי אותה' for 'אוכל' = 9.5 (Root Match overrides slang). 
# 2. IDIOM DISQUALIFICATION (INDIRECT): If the link is based ONLY on association (no shared root) and the word is used metaphorically (e.g., 'נשרף אצלי' for 'שיזוף'), score MUST be 0.0. 
# 3. FUNCTIONAL CONTRADICTION: If the ANCHOR matches the general category but violates a specific sub-type (e.g., 'Cold Cola' for 'Hot Drink'), score must be < 7.0. 
# 4. ANCHOR ISOLATION: Evaluate ONLY words in the ANCHOR. Context is for resolving pronouns ONLY. 

# # RULE SET 2: ASSOCIATION HIERARCHY
# - DIRECT/CORE (9.0-10.0): 
#     - Shared Roots (9.5-10.0). 
#     - Primary Entities defining the domain: 'בית ספר' -> 'מורה'/'מנהל' (9.5). 
#     - Direct Synonyms: 'אוקיי' -> 'בסדר' (9.4). 
# - FUNCTIONAL/HIERARCHICAL (7.5-8.9):
#     - Primary actions/institutions: 'בית ספר' -> 'תלמדי'/'וועד הורים' (8.5). 
#     - Part-of-whole: 'מדינה' -> 'עיר' (8.0). 
#     - Causal results (Physical only): 'שיזוף' -> 'נשרפתי/אדום' (8.5). 
#     - Pronoun resolution: 'לה' -> 'אולגה' (8.5). 

# # FEW-SHOTS (Graded Difficulty):

# - QUERY: 'ביצה', ANCHOR: 'תקנה תבנית ביצים', CONTEXT: 'נגמר לנו במקרר', RESULT: {"step_1_inventory": "ביצים", "step_2_resolution": "None", "reasoning": "PASSED MORPHOLOGICAL MATCH. Identical root used in plural form.", "score": 10.0} 
# - QUERY: 'אוכל', ANCHOR: 'אכלתי אותה בגדול עם המניות', CONTEXT: 'הבורסה קרסה', RESULT: {"step_1_inventory": "אכלתי", "step_2_resolution": "None", "reasoning": "PASSED MORPHOLOGICAL MATCH. Root Sovereignty: Shared root (א-כ-ל) overrides slang context.", "score": 9.5} 
# - QUERY: 'שיזוף', ANCHOR: 'הוא פשוט נשרף אצלי', CONTEXT: 'הוא שיקר לי', RESULT: {"step_1_inventory": "נשרף", "step_2_resolution": "He -> Yossi", "reasoning": "FAILED SEMANTIC IDENTITY. Metaphorical usage without a shared root (ש-ז-ף) leads to rejection.", "score": 0.0}
# - QUERY: 'שיזוף', ANCHOR: 'נשרפתי לגמרי בים', CONTEXT: 'שכחתי לשים קרם הגנה', RESULT: {"step_1_inventory": "נשרפתי", "step_2_resolution": "None", "reasoning": "PASSED CORE ASSOCIATION. 'Burnt' in a physical sun context is a direct consequence of tanning.", "score": 8.5} 
# - QUERY: 'בית ספר', ANCHOR: 'אדבר עם המנהל', CONTEXT: 'talk with teacher', RESULT: {"step_1_inventory": "המנהל", "step_2_resolution": "None", "reasoning": "PASSED CORE ASSOCIATION. Principal is a primary role defining schools.", "score": 9.5} 
# - QUERY: 'שתייה חמה', ANCHOR: 'תביא לי קולה קרה', CONTEXT: 'אני צמא מהחום', RESULT: {"step_1_inventory": "קולה", "step_2_resolution": "None", "reasoning": "FAILED FUNCTIONAL ASSOCIATION. Direct contradiction: Cold beverage provided for a 'Hot Drink' query.", "score": 6.0} 

# # OUTPUT PROTOCOL:
# 1. Reasoning MUST state "PASSED/FAILED [TEST NAME]". 
# 2. Language: English. JSON format only. 
# """



    
    # def search(self, query: str, top_k=5):
    #     # חיפוש ראשוני (וקטורי + מדויק)
    #     exact = self.storage.exact_search(query)
    #     q_vec = self.embedder.encode(f"query: {query}", normalize_embeddings=True)
    #     semantic = self.storage.vector_search(q_vec, k=15)
        
    #     candidates = self._deduplicate(exact + semantic)
        
    #     # דירוג מחדש (Reranking)
    #     return self.rerank_results(query, candidates)[:top_k]





# sds
# import json
# import time
# from google import genai

# class SearchEngine:
#     def __init__(self, storage, embedder, api_key, model_name):
#         self.storage = storage
#         self.embedder = embedder
#         self.client = genai.Client(api_key=api_key)
#         self.model_name = model_name
#         self.threshold = 7.5 # העלינו מעט את הרף לסינון משפטים גנריים

#     def search(self, query: str, top_k=5):
#         exact = self.storage.exact_search(query)
#         q_vec = self.embedder.encode(f"query: {query}", normalize_embeddings=True)
#         semantic = self.storage.vector_search(q_vec, k=15)
        
#         candidates = self._deduplicate(exact + semantic)
        
#         final_results = []
#         for res in candidates[:12]:
#             # קריאה ל-Gemini עם הלוגיקה החדשה
#             score, reasoning = self.gemini_judge(query, res["anchor_text"], res["window_text"])
            
#             if score >= self.threshold:
#                 final_results.append({
#                     "text": res["anchor_text"],
#                     "start": res["start"],
#                     "score": score,
#                     "reasoning": reasoning,
#                     "file_name": res.get("file_name", "unknown")
#                 })
        
#         return sorted(final_results, key=lambda x: x["score"], reverse=True)[:top_k]
    
#     def gemini_judge(self, query: str, anchor: str, context: str):
#         # 1. הגדרת מבנה התשובה הקשיח (Response Schema)
#         # זה מבטיח שהמודל יחזיר JSON תקין ב-100% מהמקרים
#         response_schema = {
#             "type": "OBJECT",
#             "properties": {
#                 "step_1_inventory": {"type": "STRING"},
#                 "step_2_resolution": {"type": "STRING"},
#                 "reasoning": {"type": "STRING"},
#                 "score": {"type": "NUMBER"}
#             },
#             "required": ["step_1_inventory", "step_2_resolution", "reasoning", "score"]
#         }

#         # 2. הוראות מערכת (System Instruction)
#         system_instruction = """


# last_working_prompt

# # ROLE: Hard-Line Hebrew Linguistic Auditor.
# # MISSION: Categorically validate the linguistic link between QUERY and ANCHOR.

# # RULE SET 1: QUERY & ANCHOR PROCESSING
# 1. ANCHOR ISOLATION: Evaluate ONLY words present in the ANCHOR text. 
# 2. NO THEMATIC BIAS: Do NOT give credit if the QUERY is in the CONTEXT but missing from the ANCHOR. Context is for resolving pronouns ONLY.
# 3. MORPHOLOGICAL STRICTNESS: A match requires a shared Hebrew Root (שורש) or Lemma. 
#    - Example: 'לבקש' (Request) vs 'תתקשר' (Call) is a FAIL. No shared root.

# # RULE SET 2: SEMANTIC & REFERENTIAL INTEGRITY
# 1. REFERENTIAL MAPPING: Pronouns (he, she, it, they / הוא, היא, זה, לה, אותה) must point directly to the QUERY entity. 
#    - CRITICAL: If the pronoun refers to the 'Caller' (the person asking for Olga), it is NOT a match for 'Olga'.
# 2. SEMANTIC IDENTITY: Synonyms must represent the same entity or action.
#    - Example: 'Money' -> 'Cash/Funds' is a PASS. 
#    - Example: 'Money' -> 'Bank' is a FAIL (Related but not identical).

# # RULE SET 3: SCORING & REJECTION
# - SCORE 9-10 (DIRECT): Exact name, root, or identical synonym found IN THE ANCHOR.
# - SCORE 7.5-8.9 (REFERENTIAL): A pronoun in the ANCHOR points to the QUERY entity via CONTEXT.
# - SCORE 0-2 (REJECT): 
#    - Generic threats or sentences (e.g., "Don't call here", "Understand?").
#    - Proximity/Thematic links where the QUERY/Entity is not linguistically present in the ANCHOR.
#    - Any "stretched" logic connecting unrelated verbs.

# # EXAMPLES (FEW-SHOT):
# Example 1 (REJECT): 
# Input: QUERY: 'אולגה', ANCHOR: 'למה אתה מתקשר לפה?', CONTEXT: 'מי זאת אולגה? למה אתה מתקשר לפה?'
# Output: {"step_1_inventory": "למה, אתה, מתקשר, לפה", "step_2_resolution": "אתה -> The caller", "reasoning": "FAILED ISOLATION TEST. The query name is absent from anchor.", "score": 2.0}

# Example 2 (REJECT):
# Input: QUERY: 'לבקש', ANCHOR: 'אל תתקשר לפה יותר!', CONTEXT: 'תתקשר לבקש ממנו כסף. אל תתקשר לפה יותר!'
# Output: {"step_1_inventory": "אל, תתקשר, לפה, יותר", "step_2_resolution": "None", "reasoning": "FAILED MORPHOLOGICAL TEST. Calling is related but NOT a root of requesting.", "score": 2.0}

# Example 3 (ACCEPT):
# Input: QUERY: 'אולגה', ANCHOR: 'תגיד לה לבוא מהר', CONTEXT: 'אולגה מחכה? תגיד לה לבוא מהר'
# Output: {"step_1_inventory": "תגיד, לה, לבוא, מהר", "step_2_resolution": "לה -> אולגה", "reasoning": "PASSED REFERENTIAL TEST. Direct pronoun link to query entity.", "score": 8.5}

# Example 4 (ACCEPT):
# Input: QUERY: 'כסף', ANCHOR: 'איפה המזומן שלי?', CONTEXT: 'איפה המזומן שלי?'
# Output: {"step_1_inventory": "איפה, המזומן, שלי", "step_2_resolution": "None", "reasoning": "PASSED SEMANTIC TEST. Cash is a direct synonym for Money.", "score": 10.0}

# Example 5 (ACCEPT):
# Input: QUERY: 'לבקש', ANCHOR: 'הוא ביקש עזרה', CONTEXT: 'הוא ביקש עזרה'
# Output: {"step_1_inventory": "הוא, ביקש, עזרה", "step_2_resolution": "None", "reasoning": "PASSED MORPHOLOGICAL TEST. Direct root inflection.", "score": 10.0}

# # OUTPUT PROTOCOL:
# - Internal reasoning must state "PASSED/FAILED [TEST NAME]".
# - JSON format only.
# """

#

# # ROLE: Hard-Line Hebrew Linguistic Auditor.
# # MISSION: Categorically validate the linguistic link between QUERY and ANCHOR.

# # RULE SET 1: QUERY & ANCHOR PROCESSING
# 1. ANCHOR ISOLATION: Evaluate ONLY words present in the ANCHOR text. 
# 2. NO THEMATIC BIAS: Do NOT give credit if the QUERY is in the CONTEXT but missing from the ANCHOR. Context is for resolving pronouns ONLY.
# 3. MORPHOLOGICAL STRICTNESS: A match requires a shared Hebrew Root (שורש) or Lemma. 
#    - Example: 'לבקש' (Request) vs 'תתקשר' (Call) is a FAIL. No shared root.

# # RULE SET 2: SEMANTIC & REFERENTIAL INTEGRITY
# 1. REFERENTIAL MAPPING: Pronouns (he, she, it, they / הוא, היא, זה, לה, אותה) must point directly to the QUERY entity. 
#    - CRITICAL: If the pronoun refers to the 'Caller' (the person asking for Olga), it is NOT a match for 'Olga'.
# 2. SEMANTIC IDENTITY: Synonyms must represent the same entity or action.
#    - Example: 'Money' -> 'Cash/Funds' is a PASS. 
#    - Example: 'Money' -> 'Bank' is a FAIL (Related but not identical).

# # RULE SET 3: SCORING & REJECTION
# - SCORE 9-10 (DIRECT): Exact name, root, or identical synonym found IN THE ANCHOR.
# - SCORE 7.5-8.9 (REFERENTIAL): A pronoun in the ANCHOR points to the QUERY entity via CONTEXT.
# - SCORE 0-2 (REJECT): 
#    - Generic threats or sentences (e.g., "Don't call here", "Understand?").
#    - Proximity/Thematic links where the QUERY/Entity is not linguistically present in the ANCHOR.
#    - Any "stretched" logic connecting unrelated verbs.

# # OUTPUT PROTOCOL:
# - Internal reasoning must state "PASSED/FAILED [TEST NAME]".
# - JSON format only.

#         """

#         # 3. היסטוריית צ'אט (Few-Shot History)
#         history_examples = [
#             {"role": "user", "parts": ["QUERY: 'אולגה', ANCHOR: 'למה אתה מתקשר לפה?', CONTEXT: 'מי זאת אולגה? למה אתה מתקשר לפה?'"]},
#             {"role": "model", "parts": ['{"step_1_inventory": "למה, אתה, מתקשר, לפה", "step_2_resolution": "אתה -> The caller", "reasoning": "FAILED ISOLATION TEST. The query name is absent from anchor.", "score": 2.0}']},
            
#             {"role": "user", "parts": ["QUERY: 'לבקש', ANCHOR: 'אל תתקשר לפה יותר!', CONTEXT: 'תתקשר לבקש ממנו כסף. אל תתקשר לפה יותר!'"]},
#             {"role": "model", "parts": ['{"step_1_inventory": "אל, תתקשר, לפה, יותר", "step_2_resolution": "None", "reasoning": "FAILED MORPHOLOGICAL TEST. Calling is related to the event but is NOT a root of requesting.", "score": 2.0}']},
            
#             {"role": "user", "parts": ["QUERY: 'אולגה', ANCHOR: 'תגיד לה לבוא מהר', CONTEXT: 'אולגה מחכה? תגיד לה לבוא מהר'"]},
#             {"role": "model", "parts": ['{"step_1_inventory": "תגיד, לה, לבוא, מהר", "step_2_resolution": "לה -> אולגה", "reasoning": "PASSED REFERENTIAL TEST. Direct pronoun link to query entity.", "score": 8.5}']},

#             {"role": "user", "parts": ["QUERY: 'כסף', ANCHOR: 'איפה המזומן שלי?', CONTEXT: 'איפה המזומן שלי?'"]},
#             {"role": "model", "parts": ['{"step_1_inventory": "איפה, המזומן, שלי", "step_2_resolution": "None", "reasoning": "PASSED SEMANTIC TEST. Cash is a direct synonym for Money.", "score": 10.0}']},

#             {"role": "user", "parts": ["QUERY: 'לבקש', ANCHOR: 'הוא ביקש עזרה', CONTEXT: 'הוא ביקש עזרה'"]},
#             {"role": "model", "parts": ['{"step_1_inventory": "הוא, ביקש, עזרה", "step_2_resolution": "None", "reasoning": "PASSED MORPHOLOGICAL TEST. Direct root inflection.", "score": 10.0}']}
#         ]

#         try:
#             import time
#             time.sleep(0.1) # מניעת Rate Limit בגרסת ה-Free

#             # יצירת הצ'אט עם הקונפיגורציה החדשה
#             chat = self.client.chats.create(
#                 model=self.model_name, # gemini-2.5-flash
#                 config={
#                     "system_instruction": system_instruction,
#                     "response_mime_type": "application/json",
#                     "response_schema": response_schema, # שימוש ב-Schema הרשמי
#                     "generation_config": {
#                         "temperature": 0.1
#                     }
#                 },
#                 history=history_examples
#             )

#             # שליחת הבקשה הדינמית
#             user_msg = f"QUERY: '{query}', ANCHOR: '{anchor}', CONTEXT: '{context}'"
#             response = chat.send_message(user_msg)
            
#             # פענוח JSON (בטוח יותר בגלל ה-Schema)
#             data = json.loads(response.text)
            
#             score = float(data.get('score', 0))
#             reasoning = data.get('reasoning', 'No reasoning provided')
            
#             # הגנה דטרמיניסטית אחרונה ב-Python
#             if "FAILED" in reasoning.upper() or "NO BRIDGE" in reasoning.upper():
#                 score = min(score, 2.0)

#             # בניית הנימוק לתצוגה
#             full_reasoning = f"ST1: {data.get('step_1_inventory')} | ST2: {data.get('step_2_resolution')} | ST3: {reasoning}"

#             return score, full_reasoning

#         except Exception as e:
#             print(f"⚠️ Reranker Error: {e}")
#             return 0.0, f"Error: {str(e)}"


#     def _deduplicate(self, results):
#         unique = {}
#         for r in results:
#             key = f"{r.get('file_name')}_{r['start']}"
#             if key not in unique: unique[key] = r
#         return list(unique.values())


    # #system_instructions
#         # ROLE: Hard-Line Hebrew Linguistic Auditor.
#         # PROTOCOL: 
#         1. Inventory: List words in ANCHOR only.
#         2. Resolution: Map pronouns in ANCHOR to CONTEXT.
#         3. Bridge: Find direct Morphological/Referential/Semantic link.
        
#         # MANDATORY RULES:
#         - FAILED ISOLATION: If the query name/root is not in ANCHOR, score 0-2.
#         - NO STRETCHING: Calling (תתקשר) is NOT requesting (לבקש).
#         - REFERENTIAL: Pronouns must point to the query entity, not the caller.
#         - SEMANTIC: Only direct synonyms (Money/Cash) are accepted.
#         - NO THEMATIC BIAS: Context proximity does NOT grant relevance.
# ישנה גרסה ישנה של הפונקציה למקרה שתרצה לחזור אליה בעתיד   
#     def gemini_judge(self, query: str, anchor: str, context: str):
#         prompt = f"""
# # ROLE: Hard-Line Linguistic Auditor.
# # TASK: Categorically evaluate the link between ANCHOR and QUERY.

# # INPUT DATA:
# - QUERY: "{query}"
# - ANCHOR: "{anchor}"
# - CONTEXT: "{context}"

# # MANDATORY AUDIT PROTOCOL:

# STEP 1: ANCHOR INVENTORY (Isolation)
# - List all unique nouns, verbs, and pronouns ONLY in the ANCHOR.

# STEP 2: DIRECT LINK CHECK (The "No-Stretching" Rule)
# - MORPHOLOGICAL: Does the ANCHOR contain the EXACT ROOT (שורש) or LEMMA of the QUERY? 
#   *Example: "לבקש" and "תתקשר" are NOT morphologically related. If no shared root, score 0 for this.*
# - REFERENTIAL: Does a pronoun in the ANCHOR point to "{query}" itself? 
#   *Example: If QUERY is "Olga", does the ANCHOR say "her/she"? If the ANCHOR says "You" (the caller), this is NOT a link to Olga. Score 0.*
# - SEMANTIC: Is there a direct synonym? (e.g., Airplane -> Flight).

# STEP 3: REJECTION OF THEMATIC PROXIMITY
# - Being "part of the same conversation" or "the next sentence in the rant" IS NOT A LINK.
# - Generic actions (calling, hearing, understanding) that do not mention the QUERY or its pronouns MUST be scored 0-2.

# # SCORING ALGORITHM:
# - 9-10: Exact root/name match in ANCHOR text.
# - 7.5-8.9: Pronoun in ANCHOR refers directly to the QUERY entity (not the caller).
# - 0-2: All other cases (Thematic proximity, generic threats, unrelated verbs).

# # OUTPUT FORMAT (JSON ONLY):
# {{
#   "step_1_inventory": "Words found in anchor",
#   "step_2_resolution": "Contextual meaning of pronouns",
#   "reasoning": "Identify the EXACT bridge.
#   "score": <numeric_score>
# }}
# """
#         try:
#             import time
#             time.sleep(0.2)
#             resp = self.client.models.generate_content(
#                 model=self.model_name, 
#                 contents=prompt,
#                 config={'response_mime_type': 'application/json'}
#             )
            
#             data = json.loads(resp.text)
#             if isinstance(data, list): data = data[0]

#             score = float(data.get('score', 0))

#             # בניית נימוק מפורט הכולל את שלושת השלבים
#             inventory = data.get('step_1_inventory', 'ריק')
#             resolution = data.get('step_2_resolution', 'אין')
#             bridge = data.get('bridge', 'אין גשר')

#             full_reasoning = f"ST1 (מלאי): {inventory} | ST2 (פענוח): {resolution} | ST3 (גשר): {bridge}"
            
#             # בדיקה דטרמיניסטית בקוד Python (שכבת הגנה נוספת)
#             # אם המודל לא מצא מילת גשר, אנחנו דורסים את הציון ל-0
#             reasoning_text = data.get('reasoning', '').lower()
            
#             if "none" in reasoning_text or "אין" in reasoning_text or "no bridge" in reasoning_text:
#                 score = min(score, 2.0)
            
#             return score, full_reasoning
            
#         except Exception as e:
#             print(f"⚠️ Reranker Error: {e}")
#             return 0.0, "שגיאה בניתוח הלוגי"
        
    


#     def gemini_judge(self, query: str, anchor: str, context: str):
#         # הפרומפט המאוזן שמשתמש ב-Context כ"מפענח" בלבד
# #         prompt = f"""
# # # ROLE: Senior Hebrew Linguistic Auditor.
# # # TASK: Determine if the ANCHOR refers to the QUERY, using CONTEXT for resolution.

# # # DATA:
# # QUERY: "{query}"
# # ANCHOR: "{anchor}"
# # CONTEXT: "{context}"

# # # EVALUATION PROCESS:
# # 1. **Contextual Resolution**: Use CONTEXT only to resolve pronouns (he/she/it) in the ANCHOR.
# #    - If ANCHOR is "She is here" and CONTEXT shows "she" is "{query}", it's highly relevant.
# # 2. **Linguistic Bridge**: There must be a direct link. 
# #    - Generic greetings (Hello, Hi) or filler words (Understand?, OK) get a low score (<4).
# # 3. **Scoring**:
# #    - 9-10: Explicit mention of "{query}".
# #    - 7-8.5: Clear pronoun resolution via context.
# #    - 0-4: No direct bridge, even if topic is similar.

# # # OUTPUT FORMAT (JSON ONLY):
# # {{
# #   "reasoning": "Concise explanation in HEBREW.",
# #   "score": <numeric_score>
# # }}
# # """
#         prompt = f"""
# # ROLE: Senior Linguistic Auditor.
# # TASK: Two-stage analysis of an audio segment's relevance to a search query.

# # INPUT DATA:
# - QUERY: "{query}"
# - ANCHOR (The segment): "{anchor}"
# - CONTEXT (The surrounding dialogue): "{context}"

# # STEP 1: CONTEXTUAL DECODING (Internal Analysis)
# - Read the CONTEXT and identify who is being talked about and what actions are occurring.
# - Replace all pronouns (he, she, it, they, her, him / הוא, היא, זה, לה, אותם) in the ANCHOR with their actual subjects found in the CONTEXT.
# - Result: You now have a "Resolved Anchor".

# # STEP 2: LINGUISTIC BRIDGE AUDIT (Strict Rules)
# Evaluate the "Resolved Anchor" against the QUERY using these rules:
# 1. **Morphological Match**: Does the Resolved Anchor contain the QUERY or its Hebrew root (שורש)?
# 2. **Semantic Match**: Does the Resolved Anchor contain a direct synonym, instrument, or functional consequence of the QUERY?
# 3. **Generic Rejection**: If the Resolved Anchor is a general statement (e.g., "Don't call here", "Hello", "Understand?") and has NO specific bridge word to the QUERY, it is IRRELEVANT.

# # SCORING GUIDE:
# - **9-10 (Direct)**: The QUERY or its root is explicitly in the ANCHOR.
# - **7.5-8.9 (Implicit)**: A pronoun or synonym in the ANCHOR was successfully resolved to the QUERY in Step 1.
# - **0-3 (No Bridge)**: No grammatical or semantic bridge exists in the Resolved Anchor. Proximity in context is NOT enough.

# # OUTPUT FORMAT (JSON ONLY):
# {{
#   "reasoning": "contextual_resolution: <Briefly explain who/what the ANCHOR refers to based on context (in Hebrew)>, 
#    bridge_found: <Identify the specific word or link(in Hebrew)>",
#   "score": <numeric_score>
# }}
# """

#         try:
#             time.sleep(0.5)
#             # שימוש בפורמט JSON מובנה
#             resp = self.client.models.generate_content(
#                 model=self.model_name, 
#                 contents=prompt,
#                 config={'response_mime_type': 'application/json'}
#             )
            
#             # פענוח בטוח של ה-JSON
#             data = json.loads(resp.text)
#             return float(data.get('score', 0)), data.get('reasoning', 'ללא נימוק')
            
#         except Exception as e:
#             print(f"Reranker Error: {e}")
#             return 0.0, "שגיאה בניתוח הלוגי"


# # search_engine.py
# import re
# import time
# from google import genai


# class SearchEngine:
#     def __init__(self, storage, embedder, api_key, model_name="gemini-2.0-flash-exp"):
#         self.storage = storage
#         self.embedder = embedder
#         self.client = genai.Client(api_key=api_key)
#         self.model_name = model_name
#         self.threshold = 6.5 # סף דיוק גבוה

#     def search(self, query: str, top_k=5):
#         # שלב השליפה: Hybrid Retrieval (Exact on Anchor, Semantic on Window)
#         exact = self.storage.exact_search(query)
#         q_vec = self.embedder.encode(f"query: find audio segments related to: {query}", normalize_embeddings=True)
#         semantic = self.storage.vector_search(q_vec, k=15)
        
#         candidates = self._deduplicate(exact + semantic)
        
#         final_results = []
#         for res in candidates[:12]:
#             # שלב הדירוג: Chain-of-Thought
#             score, reasoning = self.gemini_judge(query, res["anchor_text"], res["window_text"])
            
#             if score >= self.threshold:
#                 final_results.append({
#                     "text": res["anchor_text"],
#                     "start": res["start"],
#                     "score": score,
#                     "reasoning": reasoning,
#                     "file_name": res.get("file_name", "unknown")
#                 })
        
#         return sorted(final_results, key=lambda x: x["score"], reverse=True)[:top_k]

#     def gemini_judge(self, query: str, anchor: str, context: str):
#         model_name = self.model_name
        
#         # הפרומפט שתואם את הארכיטקטורה האידיאלית שתיארת
#         prompt = f"""
# # ROLE: Expert Hebrew Linguistic Analyst.
# # TASK: Evaluate the relevance of the ANCHOR to the QUERY based on the provided CONTEXT.

# # INPUT:
# QUERY: "{query}"
# ANCHOR: "{anchor}"
# CONTEXT: "{context}"

# # STEP-BY-STEP ANALYSIS (Chain-of-Thought):
# 1. **Entity Extraction**: Identify all people, objects, or topics in the CONTEXT.
# 2. **Linguistic Reconstruction**: Mentally rewrite the ANCHOR as a standalone sentence. 
#    - Replace pronouns (he/she/it/this) with the specific entities from the context.
#    - Example: If Anchor is "She took it" and Context mentions "Olga" and "Money", Reconstruction is "Olga took the money".
# 3. **Continuity Check**: Does the ANCHOR continue the topic related to the QUERY, or has the speaker shifted to a new topic (Topic Drift)?
# 4. **Final Grading (0-10)**:
#    - 10: Explicit match or perfect morphological inflection.
#    - 8-9: Flawless reconstruction (the pronoun clearly points to the Query).
#    - 6.5-7.5: Strong thematic/professional link (e.g., "flight" for "airplane").
#    - < 6.5: Weak link, Vague slang, generic fillers, or topic drift.

# # OUTPUT FORMAT:
# Reasoning: <Your step-by-step logic in one sentence>
# Score: <Numeric value>
# """
#         try:
#             time.sleep(0.5)
#             resp = self.client.models.generate_content(model=model_name, contents=prompt)
            
#             # חילוץ הציון והנימוק בעזרת Regex
#             # חילוץ הציון והנימוק
#             score_match = re.search(r"Score:\s*(\d+\.?\d*)", resp.text)
#             reasoning_match = re.search(r"Reasoning:\s*(.*)", resp.text)
            
#             score = float(score_match.group(1)) if score_match else 0.0
#             reasoning = reasoning_match.group(1) if reasoning_match else "No reasoning provided"
            
#             return score, reasoning
#         except Exception as e:
#             print(f"Reranker Error with {self.model_name}: {e}")
#             return 0.0, "Analysis failed"

#     def _deduplicate(self, results):
#         unique = {}
#         for r in results:
#             key = f"{r.get('file_name')}_{r.get('start')}"
#             if key not in unique: 
#                 unique[key] = r
#         return list(unique.values())
# # import os
# import re
# import time
# from google import genai
# from sentence_transformers import SentenceTransformer
# from storage import Storage

# class SearchEngine:
#     def __init__(self, index_dir: str):
#         self.storage = Storage(index_dir)
#         # מודל ה-Embedding תואם ל-Worker (1024 ממדים)
#         self.embedder = SentenceTransformer("intfloat/multilingual-e5-large")
#         api_key = "AIzaSyAsrhw2SCQ32JKGNR_b4cQ-6j4su-Y52jo"
#         self.client = genai.Client(api_key=api_key)

#     def gemini_judge(self, query: str, anchor: str, full_context: str) -> float:
#         """משתמש ב-Gemini כדי לדרג את הרלוונטיות של ה-ANCHOR בלבד"""
#         model_name = "gemini-2.0-flash-exp"
        
#         prompt = f"""
# תפקיד: מומחה לפענוח שפה ודירוג רלוונטיות בשיחות.
# המשימה: דרג מ-0 עד 10 את הרלוונטיות של ה-ANCHOR לשאילתה "{query}".

# נתונים:
# ---
# שאילתת המשתמש: "{query}"
# ANCHOR (המשפט לבדיקה): "{anchor}"
# CONTEXT (הקשר תומך): "{full_context}"
# ---

# תפקיד ה-CONTEXT: השתמש בו רק כדי לפענח את ה-ANCHOR (למשל, למי הכוונה במילה "הוא" או "היא", או מהו הנושא המרומז בתוך ה-ANCHOR). אל תחפש את השאילתה בתוך ה-CONTEXT עצמו.

# חוקי הדירוג:
# 1. המיקוד הוא ב-ANCHOR בלבד: הציון משקף אך ורק האם ה-ANCHOR (לאחר פענוחו בעזרת ההקשר) עוסק בשאילתה.
# 2. ענישה על "זליגת הקשר": אם השם "{query}" מופיע ב-CONTEXT אך ה-ANCHOR עצמו כבר עוסק בנושא אחר (כמו איום כללי, סגירת שיחה או נושא חדש), הציון חייב להיות 0.
# 3. דיוק גבוה: אם השאילתה מופיעה ב-ANCHOR (במדויק, במילה נרדפת, שם פעולה, או בכינוי גוף שפוענח בעזרת ה-CONTEXT), הציון הוא 10.
# 4. סף רלוונטיות: ציון מעל 5 יינתן רק אם ה-ANCHOR מקדם באופן פעיל את נושא השאילתה.

# החזר מספר בלבד (0-10).
# """
#         try:
#             resp = self.client.models.generate_content(model=model_name, contents=prompt)
#             match = re.search(r"(\d+\.?\d*)", resp.text)
#             return float(match.group(1)) if match else 0.0
#         except Exception as e:
#             # במקרה של 429 או שגיאה אחרת
#             return 0.0

#     def search(self, query: str, top_k=5):
#         # 1. שליפת מועמדים משני המקורות
#         # Exact Search מחפש ב-anchor_text ב-MongoDB
#         exact_results = self.storage.exact_search(query)
#         for r in exact_results: 
#             r["origin"] = "exact"
#             r["boost"] = 2.0

#         # Semantic Search מחפש ב-window_text (וקטורים) ב-FAISS
#         cleaned_query = query.strip().replace("?", "").replace("!", "")
#         q_vec = self.embedder.encode(f"query: {cleaned_query}", normalize_embeddings=True)
#         semantic_results = self.storage.vector_search(q_vec, k=15)
#         for r in semantic_results: 
#             r["origin"] = "semantic"
#             r["boost"] = 0.0

#         # 2. Dedup חכם - מניעת כפילויות בגלל חלונות חופפים והעדפת Exact
#         unique_candidates = {}
#         for c in exact_results + semantic_results:
#             # מפתח לפי קובץ וחלון של 15 שניות
#             time_key = f"{c.get('file_id', 'unknown')}_{round(c['start'] / 15)}"
            
#             if time_key not in unique_candidates:
#                 unique_candidates[time_key] = c
#             else:
#                 existing = unique_candidates[time_key]
#                 # חוק הקדימות: תמיד נעדיף ANCHOR שנמצא בחיפוש מדויק (Exact) על פני סמנטי באותו רגע
#                 if c["origin"] == "exact" and existing["origin"] == "semantic":
#                     unique_candidates[time_key] = c
#                 elif c["origin"] == existing["origin"]:
#                     # אם שניהם מאותו סוג, ניקח את הציון הגבוה יותר (Score של MongoDB או Vector Score)
#                     c_score = c.get('vector_score', c.get('score', 0))
#                     ex_score = existing.get('vector_score', existing.get('score', 0))
#                     if c_score > ex_score:
#                         unique_candidates[time_key] = c

#         # 3. דירוג מחדש (Reranking) בעזרת Gemini
#         final_list = []
#         # לוקחים את 8 המועמדים הטובים ביותר לשיפוט
#         top_candidates = sorted(unique_candidates.values(), 
#                                 key=lambda x: x.get('vector_score', x.get('score', 0)), 
#                                 reverse=True)[:8]

#         for res in top_candidates:
#             g_score = self.gemini_judge(query, res["anchor_text"], res["window_text"])
            
#             # השהיה קטנה למניעת שגיאת Quota (429)
#             time.sleep(0.5)
            
#             # סינון תוצאות סמנטיות לא רלוונטיות (מתחת ל-5)
#             if res["origin"] == "semantic" and g_score < 5.0:
#                 continue
            
#             # הבטחה שתוצאות Exact לא ייזרקו (ציון מינימום 5)
#             final_g_score = max(g_score, 5.0) if res["origin"] == "exact" else g_score
            
#             final_list.append({
#                 **res, 
#                 "final_score": final_g_score + res["boost"]
#             })

#         # החזרת התוצאות הסופיות ממוינות
#         return sorted(final_list, key=lambda x: x["final_score"], reverse=True)[:top_k]
# # import os
# # import re
# # import time
# # from google import genai
# # from sentence_transformers import SentenceTransformer
# # from storage import Storage


# # class SearchEngine:
# #     def __init__(self, index_dir: str):
# #         self.storage = Storage(index_dir)
# #         # מודל ה-Embedding תואם ל-Worker (1024 ממדים)
# #         self.embedder = SentenceTransformer("intfloat/multilingual-e5-large")
# #         api_key = "AIzaSyAsrhw2SCQ32JKGNR_b4cQ-6j4su-Y52jo"
# #         self.client = genai.Client(api_key=api_key)

# #     def gemini_judge(self, query: str, anchor: str, full_context: str) -> float:
# #             model_name = "gemini-2.0-flash-exp"
            
# #             prompt = f"""
# #     תפקיד: בקר איכות לחיפוש מידע בשיחות.
# #     המשימה: דרג מ-0 עד 10 את הרלוונטיות של ה-ANCHOR (המשפט המרכזי) לשאילתה "{query}".

# #     נתונים:
# #     ---
# #     שאילתה: "{query}"
# #     ANCHOR (המשפט לבדיקה): "{anchor}"
# #     CONTEXT (הקשר תומך): "{full_context}"
# #     ---

# #     תפקיד ה-CONTEXT: השתמש בו רק כדי לפענח את ה-ANCHOR (למשל, למי הכוונה במילה "הוא" או "היא", או מהו הנושא המרומז בתוך ה-ANCHOR). אל תחפש את השאילתה בתוך ה-CONTEXT עצמו.

# #     חוקי הדירוג:
# #     1. המיקוד הוא ב-ANCHOR בלבד: הציון משקף אך ורק האם ה-ANCHOR (לאחר פענוחו בעזרת ההקשר) עוסק בשאילתה.
# #     2. ענישה על "זליגת הקשר": אם השם "{query}" מופיע ב-CONTEXT אך ה-ANCHOR עצמו כבר עוסק בנושא אחר (כמו איום כללי, סגירת שיחה או נושא חדש), הציון חייב להיות 0.
# #     3. דיוק גבוה: אם השאילתה מופיעה ב-ANCHOR (במדויק, במילה נרדפת, או בכינוי גוף שפוענח בעזרת ה-CONTEXT), הציון הוא 10.
# #     4. סף רלוונטיות: ציון מעל 5 יינתן רק אם ה-ANCHOR מקדם באופן פעיל את נושא השאילתה.

# #     החזר מספר בלבד (0-10).
# #     """
# #             try:
# #                 resp = self.client.models.generate_content(model=model_name, contents=prompt)
# #                 match = re.search(r"(\d+\.?\d*)", resp.text)
# #                 return float(match.group(1)) if match else 0.0
# #             except Exception as e:
# #                 # במקרה של שגיאת Quota או API, נחזיר 0.0 כדי לא לתקוע את החיפוש
# #                 return 0.0

# #     def search(self, query: str, top_k=5):
# #         # 1. שליפת מועמדים
# #         exact_results = self.storage.exact_search(query)
# #         for r in exact_results: 
# #             r["origin"] = "exact"
# #             r["boost"] = 2.0 

# #         q_vec = self.embedder.encode(f"query: {query}", normalize_embeddings=True)
# #         semantic_results = self.storage.vector_search(q_vec, k=15)
# #         for r in semantic_results: 
# #             r["origin"] = "semantic"
# #             r["boost"] = 0.0

# #         # 2. Dedup
# #         unique_candidates = {}
# #         for c in exact_results + semantic_results:
# #             time_key = f"{c.get('file_id', 'unknown')}_{round(c['start'] / 15)}"
# #             score = c.get('vector_score', c.get('score', 0))
# #             if time_key not in unique_candidates or score > unique_candidates[time_key].get('vector_score', unique_candidates[time_key].get('score', 0)):
# #                 unique_candidates[time_key] = c

# #         # 3. דירוג וסינון
# #         final_list = []
# #         top_candidates = sorted(unique_candidates.values(), key=lambda x: x.get('vector_score', x.get('score', 0)), reverse=True)[:8]

# #         for res in top_candidates:
# #             g_score = self.gemini_judge(query, res["anchor_text"], res["window_text"])
# #             time.sleep(0.5) # מניעת 429
            
# #             # --- הלוגיקה החדשה שביקשת ---
# #             # אם זה Exact Search, אנחנו שומרים אותו בכל מקרה (גם אם הציון נמוך מ-5)
# #             # אם זה Semantic, אנחנו מסננים לפי סף 5
# #             if res["origin"] == "semantic" and g_score < 5.0:
# #                 continue
            
# #             # אם הציון של Gemini נמוך ל-Exact, ניתן לו ציון מינימלי של 5 כדי שיוצג
# #             final_g_score = max(g_score, 5.0) if res["origin"] == "exact" else g_score
            
# #             final_score = final_g_score + res["boost"]
# #             final_list.append({**res, "final_score": final_score})

# #         return sorted(final_list, key=lambda x: x["final_score"], reverse=True)[:top_k]

# # #     def gemini_judge(self, query: str, anchor: str, full_context: str) -> float:
# # #             model_name = "gemini-2.0-flash-exp"
            
# # #             prompt = f"""
# # #     תפקיד: מומחה לניתוח שפה שקובע רלוונטיות של משפט ספציפי (Anchor) מתוך שיחה.
# # #     המשימה: דרג מ-0 עד 10 עד כמה ה-Anchor רלוונטי לשאילתה.

# # #     נתונים:
# # #     ---
# # #     שאילתת המשתמש: "{query}"
# # #     המשפט לדירוג (Anchor): "{anchor}"
# # #     הקשר תומך (Context): "{full_context}"
# # #     ---

# # #     הוראות דירוג קריטיות:
# # #     1. השיפוט הוא על ה-Anchor בלבד: הציון משקף כמה ה-Anchor (המשפט המרכזי) עונה על השאילתה.
# # #     2. תפקיד ה-Context: השתמש ב-Context אך ורק כדי להבין את ה-Anchor טוב יותר. למשל:
# # #     - אם ב-Anchor כתוב "היא" וב-Context מופיע "אולגה", הבן שה-Anchor רלוונטי לאולגה.
# # #     - אם ב-Anchor כתוב "תעביר לו", וה-Context מבהיר שמדובר ב"כסף", הבן שה-Anchor רלוונטי לכסף.
# # #     3. פסילת רלוונטיות פגה: אם נושא השאילתה מופיע ב-Context אך לא מופיע ב-Anchor (וה-Anchor כבר עבר לנושא אחר), הציון חייב להיות נמוך מ-5.
# # #     4. סף ה-5: ציון מעל 5 יינתן רק אם ה-Anchor עצמו (בעזרת ההבנה מה-Context) מקדם או מכיל את נושא השאילתה.

# # #     החזר מספר בלבד (0-10). אל תוסיף מלל.
# # #     """
# # #             try:
# # #                 resp = self.client.models.generate_content(model=model_name, contents=prompt)
# # #                 match = re.search(r"(\d+\.?\d*)", resp.text)
# # #                 return float(match.group(1)) if match else 0.0
# # #             except Exception as e:
# # #                 if "429" in str(e):
# # #                     print("⏳ Quota hit - skipping item.")
# # #                 return 0.0
# # # #     def gemini_judge(self, query: str, anchor: str, full_context: str) -> float:
# # # #         """
# # # #         שולח את המידע מובנה ל-Gemini כדי להבחין בין המשפט המרכזי להקשר מסביב.
# # # #         """
# # # #         model_name = "gemini-2.0-flash-exp"
        
# # # #         # בניית פרומפט מובנה כפי שביקשת
# # # #         prompt = f"""תפקיד: עוזר מחקר לניתוח רלוונטיות של תמלולי אודיו.
# # # # המטרה: לדרג את הקשר בין שאילתת המשתמש לבין הקטע שנמצא.

# # # # שאילתת המשתמש: "{query}"


# # # # נתונים לניתוח:
# # # # ---
# # # # המשפט שנמצא (Anchor): "{anchor}"
# # # # ---
# # # # ההקשר המלא מסביב (Context): "{full_context}"
# # # # ---

# # # # הנחיות קריטיות לדירוג:
# # # # 1. עדיפות ל-Anchor: אם נושא השאילתה מופיע מפורשות בטקסט המרכזי (Anchor), הציון חייב להיות גבוה (9-10).
# # # # 2. ענישה על רלוונטיות פגה: אם נושא השאילתה מופיע *רק* ב-Context ולא מופיע ב-Anchor, וה-Anchor עוסק כבר בנושא אחר - הציון חייב להיות נמוך מ-5.
# # # # 3. הבחנה: במידה והנושא מוזכר ב-Context אך ה-Anchor הוא המשך ישיר ורלוונטי שלו, תן ציון 5-7.

# # # # סרגל ציונים:
# # # # 10: השאילתה מופיעה מפורשות בטקסט המרכזי (Anchor).
# # # # 7-9: השאילתה מופיעה ב-Context וה-Anchor הוא המשך ישיר ורלוונטי מאוד לנושא.
# # # # 5-6: קשר עקיף, או שהנושא מופיע ב-Context אך ה-Anchor מתחיל להתרחק מהנושא.
# # # # 0-4: נושא השאילתה מופיע ב-Context כשאריות ממשפטים קודמים, אך הטקסט המרכזי (Anchor) כבר עוסק בנושא אחר לגמרי.

# # # # הוראה קריטית: החזר אך ורק מספר אחד בין 0 ל-10. אל תוסיף מילה אחת מעבר למספר
# # # # """
# # # #         try:
# # # #             resp = self.client.models.generate_content(model=model_name, contents=prompt)
# # # #             # חילוץ המספר מהתשובה
# # # #             match = re.search(r"(\d+\.?\d*)", resp.text)
# # # #             return float(match.group(1)) if match else 0.0
# # # #         except Exception as e:
# # # #             print(f"❌ Gemini Error: {e}")
# # # #             return 0.0

# # #     def search(self, query: str, top_k=5):
# # #         # 1. שליפת מועמדים (Exact + Semantic)
# # #         cleaned_query = query.strip().replace("?", "").replace("!", "")
# # #         exact_results = self.storage.exact_search(cleaned_query)
# # #         for r in exact_results: 
# # #             r["origin"] = "exact"
# # #             r["boost"] = 2.0 


# # #         q_vec = self.embedder.encode(f"query: {cleaned_query}", normalize_embeddings=True)
# # #         semantic_results = self.storage.vector_search(q_vec, k=20)
# # #         for r in semantic_results: 
# # #             r["origin"] = "semantic"
# # #             r["boost"] = 0.0

# # #         # 2. Dedup חכם: בחירת המועמד הטוב ביותר מכל חלון זמן (15 שניות)
# # #         unique_candidates = {}
# # #         for c in exact_results + semantic_results:
# # #             time_key = f"{c.get('file_id', 'unknown')}_{round(c['start'] / 15)}"
            
# # #             # לקיחת המועמד בעל הציון הגבוה ביותר בתוך חלון הזמן
# # #             current_score = c.get('vector_score', c.get('score', 0))
# # #             if time_key not in unique_candidates:
# # #                 unique_candidates[time_key] = c
# # #             else:
# # #                 existing_score = unique_candidates[time_key].get('vector_score', unique_candidates[time_key].get('score', 0))
# # #                 if current_score > existing_score:
# # #                     unique_candidates[time_key] = c

# # #         # 3. דירוג מחדש וסינון רלוונטיות
# # #         final_list = []
# # #         # עוברים על המועמדים המובילים (עד 8)
# # #         top_candidates = sorted(unique_candidates.values(), 
# # #                                 key=lambda x: x.get('vector_score', x.get('score', 0)), 
# # #                                 reverse=True)[:8]

# # #         for res in top_candidates:
# # #             # שליחת ה-Anchor וה-Context בנפרד לפרומפט המובנה
# # #             g_score = self.gemini_judge(query, res["anchor_text"], res["window_text"])
            
# # #             # סף רלוונטיות (Threshold): פוסל תוצאות חלשות
# # #             if g_score < 5.0:
# # #                 continue
                
# # #             final_score = g_score + res["boost"]
# # #             final_list.append({**res, "final_score": final_score})

# # #         # 4. מיון סופי להצגה
# # #         return sorted(final_list, key=lambda x: x["final_score"], reverse=True)[:top_k]
    
# # # # search_engine.py
# # # import os
# # # import re
# # # from google import genai
# # # from sentence_transformers import SentenceTransformer
# # # from storage import Storage

# # # class SearchEngine:
# # #     def __init__(self, index_dir: str):
# # #         self.storage = Storage(index_dir)
# # #         # שימוש ב-E5-Large (1024) - חובה להתאים ל-Worker
# # #         self.embedder = SentenceTransformer("intfloat/multilingual-e5-large")
# # #         self.client = genai.Client(api_key="AIzaSyAsrhw2SCQ32JKGNR_b4cQ-6j4su-Y52jo")

# # #     def gemini_judge(self, query: str, context: str) -> float:
# # #         prompt = f"דרג מ-0 עד 10 כמה הקטע הבא רלוונטי לשאלה: '{query}'\nקטע: '{context}'\nהחזר מספר בלבד."
# # #         try:
# # #             resp = self.client.models.generate_content(model="gemini-1.5-flash", contents=prompt)
# # #             return float(re.sub(r"[^\d.]", "", resp.text.strip()))
# # #         except:
# # #             return 0.0

# # #     def search(self, query: str, top_k=5):
# # #         # 1. חיפוש מדויק (MongoDB) - מקבל בונוס התחלתי
# # #         exact_candidates = self.storage.exact_search(query)
# # #         for c in exact_candidates:
# # #             c["origin"] = "exact"
# # #             c["boost"] = 2.0 # בונוס לתוצאה מדויקת

# # #         # 2. חיפוש סמנטי (FAISS)
# # #         q_vec = self.embedder.encode(f"query: {query}", normalize_embeddings=True)
# # #         semantic_candidates = self.storage.vector_search(q_vec)
# # #         for c in semantic_candidates:
# # #             c["origin"] = "semantic"
# # #             c["boost"] = 0.0

# # #         # 3. איחוד וסינון כפילויות (Dedup)
# # #         combined = exact_candidates + semantic_candidates
# # #         unique_results = []
# # #         seen_keys = set()
        
# # #         for c in combined:
# # #             # מפתח ייחודי לפי קובץ וזמן (חלון של 10 שניות)
# # #             key = f"{c.get('file_name', 'unknown')}_{round(c['start'] / 10)}"
# # #             if key not in seen_keys:
# # #                 unique_results.append(c)
# # #                 seen_keys.add(key)

# # #         # 4. Reranking עם Gemini (לוקחים את ה-8 הכי טובים מהאיחוד)
# # #         final_scored = []
# # #         for res in unique_results[:8]:
# # #             g_score = self.gemini_judge(query, res["window_text"])
# # #             # הציון הסופי משלב Gemini + הבונוס של החיפוש המדויק
# # #             final_score = g_score + res["boost"]
            
# # #             final_scored.append({**res, "final_score": final_score})

# # #         # מיון סופי - Exact Search יופיע ראשון אם Gemini אישר רלוונטיות
# # #         final_scored.sort(key=lambda x: x["final_score"], reverse=True)
# # #         return final_scored[:top_k]
# # # # # search_engine.py
# # # # import os
# # # # import re
# # # # from google import genai
# # # # from sentence_transformers import SentenceTransformer
# # # # from storage import Storage

# # # # class SearchEngine:
# # # #     def __init__(self, index_dir: str):
# # # #         # אתחול רכיב האחסון והחיפוש הוקטורי
# # # #         self.storage = Storage(index_dir)
# # # #         # שימוש במודל ה-Embedding התואם ל-Worker
# # # #         self.embedder = SentenceTransformer("intfloat/multilingual-e5-large")
        
# # # #         # אתחול ה-Client של Gemini
# # # #         api_key = "AIzaSyAsrhw2SCQ32JKGNR_b4cQ-6j4su-Y52jo"
# # # #         self.client = genai.Client(api_key=api_key)

# # # #     def gemini_judge(self, query: str, context: str) -> float:
# # # #         """
# # # #         משתמש ב-Gemini כדי לדרג את הרלוונטיות של הקטע לשאלה.
# # # #         """
# # # #         prompt = f"""
# # # #         דרג מ-0 עד 10 כמה הקטע הבא רלוונטי לשאלה/שאילתה של המשתמש.
        
# # # #         שאילתה: "{query}"
# # # #         קטע מהקלטה: "{context}"

# # # #         החזר אך ורק מספר בין 0 ל-10.
# # # #         """
# # # #         try:
# # # #             response = self.client.models.generate_content(
# # # #                 model="gemini-1.5-flash", 
# # # #                 contents=prompt
# # # #             )
# # # #             # ניקוי הטקסט למקרה שחזרו תווים מיותרים
# # # #             score_text = re.sub(r"[^\d.]", "", response.text.strip())
# # # #             return float(score_text)
# # # #         except Exception as e:
# # # #             print(f"Error in Gemini judging: {e}")
# # # #             return 0.0

# # # #     def search(self, query: str, top_k=5):
# # # #         """
# # # #         מבצע חיפוש היברידי: FAISS למציאת מועמדים ו-Gemini לדירוג סופי.
# # # #         """
# # # #         # 1. יצירת וקטור לשאילתה (שימוש בקידומת query: עבור מודל E5)
# # # #         q_vec = self.embedder.encode(f"query: {query}", normalize_embeddings=True)

# # # #         # 2. שליפת מועמדים ראשוניים מ-FAISS (מביא 20 כדי שיהיה ממה לסנן)
# # # #         candidates = self.storage.search(q_vec, k=20)

# # # #         # 3. Dedup - מניעת הצגת תוצאות חופפות מאותו קובץ ובזמנים קרובים
# # # #         unique_candidates = []
# # # #         seen_segments = set()
        
# # # #         for c in candidates:
# # # #             # יצירת מפתח ייחודי לפי קובץ וחלון זמן של 10 שניות
# # # #             time_key = f"{c['file_name']}_{round(c['start'] / 10)}"
# # # #             if time_key not in seen_segments:
# # # #                 unique_candidates.append(c)
# # # #                 seen_segments.add(time_key)

# # # #         # 4. Reranking - שימוש ב-Gemini לדירוג המועמדים המובילים (טופ 6)
# # # #         scored_results = []
# # # #         for res in unique_candidates[:6]:
# # # #             # שימוש ב-window_text (ההקשר הרחב) עבור Gemini
# # # #             g_score = self.gemini_judge(query, res["window_text"])
            
# # # #             # שקלול סופי: 70% Gemini ו-30% דמיון וקטורי (מנורמל)
# # # #             # ה-vector_score של FAISS ב-Inner Product נע לרוב בין 0.7 ל-1.0
# # # #             final_score = (g_score * 0.7) + (res["vector_score"] * 3.0)
            
# # # #             scored_results.append({
# # # #                 "anchor_text": res["anchor_text"],
# # # #                 "window_text": res["window_text"],
# # # #                 "start": res["start"],
# # # #                 "file_name": res["file_name"],
# # # #                 "score": round(final_score, 2)
# # # #             })

# # # #         # מיון לפי הציון המשוקלל והחזרת top_k
# # # #         scored_results.sort(key=lambda x: x["score"], reverse=True)
# # # #         return scored_results[:top_k]
# # # # # # search_engine.py
# # # # # from sentence_transformers import SentenceTransformer
# # # # # from storage import Storage
# # # # # import re
# # # # # import os
# # # # # from google import genai

# # # # # EMBEDDING_MODEL = "intfloat/multilingual-e5-base"

# # # # # class SearchEngine:
# # # # #     def __init__(self, data_path: str):
# # # # #         self.storage = Storage()
# # # # #         self.storage.load(data_path)
# # # # #         self.embedder = SentenceTransformer(EMBEDDING_MODEL)

# # # # #         api_key = os.getenv("GEMINI_API_KEY")
# # # # #         genai.configure(api_key=api_key)
# # # # #         self.gemini = genai.GenerativeModel("gemini-1.5-flash")

# # # # #     def exact_score(self, query: str, text: str) -> float:
# # # # #         q_words = set(re.findall(r"\w+", query))
# # # # #         t_words = set(re.findall(r"\w+", text))
# # # # #         if not q_words:
# # # # #             return 0.0
# # # # #         return len(q_words & t_words) / len(q_words)

# # # # #     def gemini_judge(self, query: str, text: str) -> float:
# # # # #         prompt = f"""
# # # # #         Query: "{query}"
# # # # #         Segment: "{text}"

# # # # #         Score relevance from 0 to 10.
# # # # #         Return only a number.
# # # # #         """
# # # # #         try:
# # # # #             resp = self.gemini.generate_content(prompt)
# # # # #             return float(resp.text.strip())
# # # # #         except:
# # # # #             return 0.0

# # # # #     def search(self, query: str, top_k=5):
# # # # #         q_vec = self.embedder.encode(
# # # # #             f"query: {query}", normalize_embeddings=True
# # # # #         )

# # # # #         candidates = self.storage.search(q_vec, k=30)

# # # # #         scored = []
# # # # #         for c in candidates:
# # # # #             exact = self.exact_score(query, c["anchor_text"])
# # # # #             scored.append({
# # # # #                 **c,
# # # # #                 "exact": exact
# # # # #             })

# # # # #         scored.sort(key=lambda x: x["exact"], reverse=True)
# # # # #         top = scored[:10]

# # # # #         results = []
# # # # #         for r in top:
# # # # #             g = self.gemini_judge(query, r["anchor_text"])
# # # # #             final = 0.7 * g + 0.3 * r["exact"] * 10
# # # # #             results.append({
# # # # #                 "text": r["anchor_text"],
# # # # #                 "start": r["start"],
# # # # #                 "score": final
# # # # #             })

# # # # #         results.sort(key=lambda x: x["score"], reverse=True)
# # # # #         return results[:top_k]
