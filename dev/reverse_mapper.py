import json

with open('../prototype/acronym/zeroshot/diction.json', 'r') as infile:
    json_data = json.load(infile)

reverse_mapping = {}

for key, values in json_data.items():
    for value in values:
        value = value.lower() # lowercase definitions!
        if value in reverse_mapping:
            if key not in reverse_mapping[value]:
                reverse_mapping[value].append(key)
        else:
            reverse_mapping[value] = [key]

with open('../prototype/acronym/zeroshot/reverse_dict.json', 'w') as outfile:
    json.dump(reverse_mapping, outfile)

print("Reverse mapping saved to 'reverse_dict.json'")