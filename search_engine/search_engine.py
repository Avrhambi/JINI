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
