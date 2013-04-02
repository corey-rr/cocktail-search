$(function() {
	var Cocktail = Backbone.Model.extend();

	var SearchResults = Backbone.Collection.extend({
		model: Cocktail,

/*
		initialize : function(models, options) {
			this.ingredients = options.ingredients;
		},
*/
		url: function() {
			return '/recipes?' + $.param($.map(this.ingredients, function(x) {
				return {name: 'ingredient', value: x};
			}));
		},
		parse: function(resp, options) {
			this.canLoadMore = resp.length > 0;
			return resp;
		}
	});

	var CocktailView = Backbone.View.extend({
		className: 'cocktail',

		events: {
			'click .sources a[href]': 'onSwitchRecipe'
		},

		template: _.template($('#cocktail-template').html()),

		render: function() {
			var sources = _.groupBy(
				this.model.get('recipes'),
				function(recipe) { return recipe.source; }
			);

			var recipe = sources[
				this.currentSource || _.keys(sources)[0]
			][
				this.currentRecipe || 0
			];

			this.$el.html(this.template({recipe: recipe, sources: sources}));
			return this;
		},

		onSwitchRecipe: function(event) {
			var link = $(event.currentTarget);

			this.currentSource = link.attr('data-source');
			this.currentRecipe = link.attr('data-recipe');

			this.setElement(this.render().$el);
		}
	});

	var SearchResultsView = Backbone.View.extend({
		el: $('#search-results'),

		initialize : function(options) {
			_.bindAll(this, 'add', 'remove');

			this.cocktailViews = [];

			this.collection.each(this.add);

			this.collection.bind('add', this.add);
			this.collection.bind('remove', this.remove);
		},

		add: function(cocktail) {
			var view = new CocktailView({model: cocktail});
			view.setElement(view.render().$el.appendTo(this.$el));
			this.cocktailViews.push(view);
		},

		remove: function(cocktail) {
			_.each(this.cocktailViews, function(view) {
				if (view.model == cocktail) {
					view.$el.remove();
					this.cocktailViews = _.without(this.cocktailViews, view);
				}
			});
		}
	});

	var collection = new SearchResults();
	var view = new SearchResultsView({collection: collection});


	var results = $('#search-results');
	var form = $('form');
	var viewport = $(window);

	var initial_field = $('input', form).val('');;
	var empty_field = initial_field.clone();
	var original_title = document.title;

	var offset = 0;
	var can_load_more = false;
	var ingredients;

	var state;
	var state_is_volatile;

	var updateTitle = function() {
		var title = original_title;

		if (ingredients.length > 0)
			title += ': ' + ingredients.join(', ');

		document.title = title;
	};

	var prepareField = function(field) {
		field.keyup(function() {
			var has_empty = false;
			var new_state;

			ingredients = [];

			$('input', form).each(function(idx, field) {
				if (field.value != '')
					ingredients.push(field.value);
				else
					has_empty = true;
			});

			new_state  = ingredients.length > 0 ? '#' : '';
			new_state += ingredients.map(encodeURIComponent).join(';');

			if (!has_empty)
				addField();

			if (new_state == state)
				return;

			history[
				state_is_volatile
					? 'replaceState'
					: 'pushState'
			](null, null, new_state || '.');

			state = new_state;
			state_is_volatile = true;

			updateTitle();

			collection.ingredients = ingredients;
			collection.fetch();
		});

		field.blur(function() {
			$('input', form).filter(function() {
				return this.value == '';
			}).slice(0, -1).remove();
		});
	};

	var addField = function () {
		var field = empty_field.clone();

		form.append(field);
		prepareField(field);

		return field;
	};

	var populateForm = function() {
		state = document.location.hash;
		state_is_volatile = false;
		ingredients = [];

		var bits = state.substring(1).split(';');
		var field;

		$('input', form).remove();

		for (var i = 0; i < bits.length; i++) {
			var ingredient = decodeURIComponent(bits[i]);

			if (ingredient == '')
				continue;

			field = addField();
			field.val(ingredient);

			ingredients.push(ingredient);
		}

		field = addField();

		// automatically focus the empty field only on webkit browsers. Other
		// browsers hide the placeholder as soon as the field is focused and
		// might confuse users, as they wouldn't know what to enter.
		if (/ AppleWebKit\//.test(navigator.userAgent))
			field.focus();

		updateTitle();

		collection.ingredients = ingredients;
		collection.fetch();
	};

	results.mousedown(function() {
		state_is_volatile = false;
	});

	viewport.scroll(function() {
		state_is_volatile = false;

		if (!collection.canLoadMore)
			return;
		if (viewport.scrollTop() + viewport.height() < $('.cocktail').slice(-5)[0].offsetTop)
			return;

		collection.canLoadMore = false;
		collection.fetch({remove:false, data:{offset:collection.length}});
	});

	viewport.on('popstate', populateForm);

	prepareField(initial_field);
	populateForm();
});
