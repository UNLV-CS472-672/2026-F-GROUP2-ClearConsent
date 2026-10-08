<script lang="ts">
	let { children } = $props();
</script>

<table class="w-19/20 table-fixed">
			<colgroup>
				<col style="width:3%" />
				<col style="width:5%" />
				<col style="width:3%" />
				<col style="width:1%" />
			</colgroup>

			<thead>
				{@render children()}
			</thead>
		</table>