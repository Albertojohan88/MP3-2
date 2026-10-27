import importlib.util
import unittest
from unittest.mock import patch
from urllib.error import HTTPError
from io import BytesIO

spec = importlib.util.spec_from_file_location('requests_importer', 'scripts/youtube_requests.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


def issue(number=1, title='La canción', artist='Artista & invitados'):
    return {'number': number, 'title': 'Petición musical: ' + title,
            'body': f'### Canción\n\n{title}\n\n### Artista\n\n{artist}'}


class RequestsTest(unittest.TestCase):
    def test_parses_unicode_and_ignores_other_issues(self):
        value = m.song_request(issue())
        self.assertEqual(value['query'], 'La canción Artista & invitados')
        self.assertIsNone(m.song_request({'title': 'Comentario', 'number': 1}))
        self.assertIsNone(m.song_request({**issue(), 'pull_request': {}}))
        self.assertIsNone(m.song_request(issue(title='a\nb')))
        self.assertIsNone(m.song_request(issue(artist='x' * 121)))

    def test_duplicate_requests_do_not_consume_quota_again(self):
        searches = []
        def search(query):
            searches.append(query)
            return {'id': 'M7lc1UVf-VE', 'youtubeTitle': 'Resultado'}
        tracks, misses = m.update_catalog([], [issue(1), issue(2)], search)
        self.assertEqual(len(tracks), 1)
        self.assertEqual(len(searches), 1)
        self.assertEqual(m.update_catalog(tracks, [issue(3)], search)[0], tracks)
        self.assertEqual(len(searches), 1)

    def test_missing_results_do_not_starve_other_requests(self):
        tracks, misses = m.update_catalog([], [issue()], lambda q: None)
        self.assertEqual(tracks, [])
        self.assertEqual(len(misses), 1)
        tracks, _ = m.update_catalog([], [issue(), issue(2, title='Otra')],
                                    lambda q: {'id': 'M7lc1UVf-VE', 'youtubeTitle': 'Otro'}, misses)
        self.assertEqual([x['request'] for x in tracks], [2])

    def test_limits_searches_per_run(self):
        tracks, _ = m.update_catalog([], [issue(i, title=str(i)) for i in range(15)],
                                     lambda q: {'id': 'M7lc1UVf-VE', 'youtubeTitle': 'Resultado'})
        self.assertEqual(len(tracks), 10)

    def test_search_filters_embeddable_and_keeps_key_out_of_url(self):
        def response(request, timeout):
            self.assertIn('videoEmbeddable=true', request.full_url)
            self.assertIn('type=video', request.full_url)
            self.assertNotIn('test-key', request.full_url)
            self.assertEqual(request.get_header('X-goog-api-key'), 'test-key')
            return BytesIO(b'{"items":[{"id":{"videoId":"M7lc1UVf-VE"},"snippet":{"title":"Demo"}}]}')
        with patch.object(m.urllib.request, 'urlopen', response):
            self.assertEqual(m.youtube_search('canci\u00f3n & artista', 'test-key')['id'], 'M7lc1UVf-VE')
        with patch.object(m.urllib.request, 'urlopen', return_value=BytesIO(b'{"items":[]}')):
            self.assertIsNone(m.youtube_search('no result', 'test-key'))
        with patch.object(m.urllib.request, 'urlopen', side_effect=HTTPError('test', 403, 'quota', {}, None)):
            with self.assertRaises(HTTPError):
                m.youtube_search('quota exceeded', 'test-key')


if __name__ == '__main__':
    unittest.main()
