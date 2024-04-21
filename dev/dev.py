from flask import Flask, request, jsonify
from flask_cors import CORS
import requests, json, enchant, re, pdb

app = Flask(__name__)
CORS(app)

d = enchant.Dict("en_US")

with open("../prototype/acronym/zeroshot/reverse_dict.json") as f:
    reverse_dict = json.load(f)

def disambiguate(query, use_zeroshot=True):
    '''disambiguate a string which can contain multiple acronyms, returns all acronym/definition mappings'''
    result = requests.post('http://127.0.0.1:5000/extension', json={'text': query, 'use_zeroshot': True }, headers={'Content-Type': 'application/json'})
    json_string = result.content.decode('utf-8')
    result_dict = json.loads(json_string)
    predictions = result_dict['acronym_predictions']
    if not predictions:
        return None
    else:
        predictions = predictions.values()

    mapping_dict = {}
    print("query:",query)

    print("predictions:", predictions)
    for prediction in predictions:
        top3 = [] # or less than 3, if less than 3 unique candidates
        i = 0

        # top_definition = prediction[1]['zeroshot'][0]
        # print("top definition:", top_definition)
        definitions = prediction[1]['zeroshot'][1]
        definitions = [item[0].lower() for item in definitions] # just words, not probability

        # top 3 unique disambiguations
        while len(top3) < 3 and i < len(definitions):
            if definitions[i] not in top3:
                top3.append(definitions[i])
            i += 1

        acronym = reverse_dict[top3[0]][0]
        mapping_dict[acronym] = top3

    return mapping_dict

@app.route("/modify_query", methods=["POST"])
def modify_query():
    data = request.get_json()
    query = data['text']
    use_zeroshot = data['use_zeroshot']

    query_changed = False

    separators = r'([ (),.!?;:\-\n"])'
    words = re.split(separators, query)
    print("words at 54:", words)
    alt_words = words.copy()

    # 1. Capitalize any uncapitalized likely acronyms

    print("before capitalization:", words)

    for i in range(len(words)):
        if words[i]:
            match = re.search(separators, words[i])
            if not match and "'" not in words[i]: # ignore ' words
                if d.check(words[i]) == False: # not a dictionary word
                    words[i] = words[i].upper()

    print("after capitalization:", words)

    query = "".join(words) # query w/ likely acronyms capitalized

    # 2. Find definitions for all acronyms

    mapping = disambiguate(query, use_zeroshot)
    print("mapping:", mapping)
    
    if mapping:
        query_changed = True
        for i in range(len(words)):
            if words[i] != "AND" and words[i] != "OR": # don't treat and/or as acronyms
                if words[i] in mapping and mapping[words[i]][0] not in query.lower(): # not already disambiguated in current query
                    alt_words[i] = [words[i], mapping[words[i]]]
                    words[i] = "(" + words[i] + " OR " + mapping[words[i]][0] + ")"

        query = "".join(words)
    
    print("words at 86:", words)
    print("alt words at 86:", alt_words)

    print("after short=>long disambiguation:", query)

    # 3. Find acronyms for all definitions

    final_words = []

    i = 0
    j = len(words)
    while i < len(words):
        j = len(words)
        while j > 0:
            phrase = "".join(words[i:j])
            if phrase.lower() in reverse_dict:
                if reverse_dict[phrase.lower()][0] not in query: # make sure not already disambiguated elsewhere in query - would be all caps for acronym
                    print("found " + phrase + " in reverse_dict")
                    final_words.append("(" + phrase + " OR " + reverse_dict[phrase.lower()][0] + ")")
                    i = j
                    query_changed = True
                    break
            else:
                j -= 1
        else: # no break
            final_words.append(alt_words[i])
            i += 1

    # query = "".join(final_words)
    print("final words:", final_words)

    print("after long=>short disambiguation:", query)

    print("query_changed:",query_changed)

    if not query_changed:
        return None

    return jsonify(final_words)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port='5001')